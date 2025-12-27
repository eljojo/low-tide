// SPDX-License-Identifier: AGPL-3.0-only
package main

import (
	"database/sql"
	"embed"
	"encoding/json"
	"fmt"
	"html/template"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/websocket"
	_ "github.com/mattn/go-sqlite3"

	"low-tide/config"
	"low-tide/jobs"
	"low-tide/store"
)

//go:embed templates/*.html static/*
var assets embed.FS

var indexTmpl = template.Must(template.ParseFS(assets, "templates/index.html"))

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

type Server struct {
	DB  *sql.DB
	Cfg *config.Config
	Mgr *jobs.Manager
}

func main() {
	cfgPath := "config/config.yaml"
	if env := os.Getenv("LOWTIDE_CONFIG"); env != "" {
		cfgPath = env
	}

	cfg, err := config.Load(cfgPath)
	if err != nil {
		log.Fatalf("load config: %v", err)
	}

	db, err := sql.Open("sqlite3", cfg.DBPath+"?_fk=1")
	if err != nil {
		log.Fatalf("open db: %v", err)
	}
	defer db.Close()

	if err := store.Init(db); err != nil {
		log.Fatalf("init db: %v", err)
	}

	// Normalize watch dir
	cfg.WatchDir, err = filepath.Abs(cfg.WatchDir)
	if err != nil {
		log.Fatalf("abs watch_dir: %v", err)
	}

	mgr, err := jobs.NewManager(db, cfg)
	if err != nil {
		log.Fatalf("new manager: %v", err)
	}

	srv := &Server{DB: db, Cfg: cfg, Mgr: mgr}

	mux := http.NewServeMux()
	mux.HandleFunc("/", srv.handleIndex)
	mux.Handle("/static/", http.FileServer(http.FS(assets)))
	mux.HandleFunc("/api/jobs", srv.handleJobs)
	mux.HandleFunc("/api/jobs/clear", srv.handleClearJobs)
	mux.HandleFunc("/api/jobs/", srv.handleJobAction)
	mux.HandleFunc("/ws/state", srv.handleStateWS)

	log.Printf("Low Tide listening on %s", cfg.ListenAddr)
	log.Fatal(http.ListenAndServe(cfg.ListenAddr, loggingMiddleware(mux)))
}

func (s *Server) handleIndex(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}

	type AppInfo struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	}
	var apps []AppInfo
	for _, app := range s.Cfg.Apps {
		apps = append(apps, AppInfo{ID: app.ID, Name: app.Name})
	}

	appsJSON, _ := json.Marshal(apps)

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	err := indexTmpl.Execute(w, map[string]any{
		"AppsJSON": template.JS(appsJSON),
	})
	if err != nil {
		log.Printf("execute template: %v", err)
		http.Error(w, err.Error(), 500)
	}
}

func (s *Server) handleJobs(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		jobsList, err := store.ListJobs(s.DB, 100)
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		// annotate has_files and counts
		type jobWithFiles struct {
			store.Job
			HasFiles  bool `json:"has_files"`
			FileCount int  `json:"file_count"`
		}
		out := make([]jobWithFiles, 0, len(jobsList))
		for _, j := range jobsList {
			fCount, err := store.CountJobArtifacts(s.DB, j.ID)
			if err != nil {
				http.Error(w, err.Error(), 500)
				return
			}
			out = append(out, jobWithFiles{Job: j, HasFiles: fCount > 0, FileCount: fCount})
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(out)
	case http.MethodPost:
		// Use FormValue so Go handles both urlencoded and multipart/form-data.
		appID := r.FormValue("app_id")
		urlsRaw := r.FormValue("urls")
		log.Printf("/api/jobs POST app_id=%q urlsRaw=%q", appID, urlsRaw)
		log.Printf("/api/jobs PostForm=%v MultipartForm=%v", r.PostForm, r.MultipartForm)

		urls := splitURLs(urlsRaw)
		if len(urls) == 0 {
			log.Printf("/api/jobs rejecting: len(urls)=%d appID=%q", len(urls), appID)
			http.Error(w, "missing urls", 400)
			return
		}
		// If client asked for auto mapping, try to match the first URL to a configured app
		if appID == "auto" || appID == "" {
			if a := s.Cfg.MatchAppForURL(urls[0]); a != nil {
				appID = a.ID
			}
		}
		if s.Cfg.GetApp(appID) == nil {
			log.Printf("/api/jobs unknown app_id=%q", appID)
			http.Error(w, "unknown app_id", 400)
			return
		}
		// Create one job per URL (single-URL-per-job model)
		var ids []int64
		for _, u := range urls {
			jid, err := store.InsertJob(s.DB, appID, u, time.Now())
			if err != nil {
				http.Error(w, err.Error(), 500)
				return
			}
			ids = append(ids, jid)
			s.Mgr.Queue <- jid
			// broadcast queued job per-job
			s.Mgr.BroadcastJobSnapshot(jid)
			go s.Mgr.FetchAndSaveTitle(jid, u)
		}

		w.Header().Set("Content-Type", "application/json")
		if len(ids) == 1 {
			_ = json.NewEncoder(w).Encode(map[string]any{"id": ids[0]})
		} else {
			_ = json.NewEncoder(w).Encode(map[string]any{"ids": ids})
		}
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

func (s *Server) handleClearJobs(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	if err := store.ArchiveFinishedJobs(s.DB); err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	// broadcast state change that jobs were archived
	s.Mgr.BroadcastState(map[string]string{"type": "jobs_archived"})
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleJobAction(w http.ResponseWriter, r *http.Request) {
	// /api/jobs/{id}/action or /api/jobs/{id}/files/{fileid}
	pathSuffix := strings.TrimPrefix(r.URL.Path, "/api/jobs/")
	parts := strings.Split(pathSuffix, "/")

	if len(parts) == 1 {
		// GET /api/jobs/{id}
		idStr := parts[0]
		id, err := strconv.ParseInt(idStr, 10, 64)
		if err != nil {
			http.Error(w, "invalid id", 400)
			return
		}
		if r.Method == http.MethodGet {
			s.handleJobSnapshot(w, r, id)
			return
		}
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	idStr := parts[0]
	action := parts[1]
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		http.Error(w, "invalid id", 400)
		return
	}

	switch action {
	case "retry":
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		if err := store.ResetJobForRetry(s.DB, id); err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		s.Mgr.Queue <- id
		s.Mgr.BroadcastJobSnapshot(id)
		w.WriteHeader(http.StatusNoContent)
	case "cancel":
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		if err := s.Mgr.CancelJob(id); err != nil {
			http.Error(w, err.Error(), 400)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	case "zip":
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		s.handleZip(w, r, id)
	case "logs":
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		s.handleJobLogs(w, r, id)
	case "files":
		// DEPRECATED: /api/jobs/{id}/files is now part of the snapshot.
		// Only support DELETE (cleaning up) or specific file downloads.
		if len(parts) == 2 {
			if r.Method == http.MethodDelete {
				s.handleDeleteFiles(w, r, id)
				return
			}
			http.NotFound(w, r)
			return
		}
		// If URL is /api/jobs/{id}/files/{fid} -> serve file/dir download
		if len(parts) >= 3 {
			fidStr := parts[2]
			fid, err := strconv.ParseInt(fidStr, 10, 64)
			if err != nil {
				http.Error(w, "invalid file id", 400)
				return
			}
			if r.Method != http.MethodGet {
				w.WriteHeader(http.StatusMethodNotAllowed)
				return
			}
			s.handleDownloadArtifact(w, r, id, fid)
			return
		}
	case "archive":
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		if err := store.ArchiveJob(s.DB, id); err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		// broadcast state change
		s.Mgr.BroadcastJobSnapshot(id)
		w.WriteHeader(http.StatusNoContent)
		return
	case "cleanup":
		// Cleanup = archive + delete files + status=cleaned
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		// 1. Set status to cleaned and archived in DB first
		if err := store.MarkJobCleaned(s.DB, id); err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		// 2. Remove files from disk (watcher will now ignore these)
		if err := s.deleteJobArtifacts(id); err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		// broadcast state change
		s.Mgr.BroadcastJobSnapshot(id)
		w.WriteHeader(http.StatusNoContent)
		return
	default:
		http.NotFound(w, r)
	}
}

func (s *Server) handleZip(w http.ResponseWriter, r *http.Request, jobID int64) {
	files, err := store.ListJobFiles(s.DB, jobID)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	if len(files) == 0 {
		http.Error(w, "no files for job", 404)
		return
	}

	// Prepare zip download
	// TODO: give this a nicer safe name based on job info
	setDownloadHeaders(w, "job.zip")

	zw := newZipWriter(w, s.Cfg.WatchDir)
	defer zw.Close()

	for _, f := range files {
		if err := zw.AddFile(f.Path); err != nil {
			log.Printf("zip file %s: %v", f.Path, err)
		}
	}
}

func (s *Server) handleJobSnapshot(w http.ResponseWriter, r *http.Request, jobID int64) {
	j, err := store.GetJob(s.DB, jobID)
	if err != nil {
		http.Error(w, "job not found", 404)
		return
	}

	files, err := store.ListJobFiles(s.DB, jobID)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}

	rel := make([]store.JobFile, 0, len(files))
	for _, f := range files {
		f.Path = toRelPath(s.Cfg.WatchDir, f.Path)
		if f.Path == "" {
			continue
		}
		rel = append(rel, f)
	}
	j.Files = rel

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(j)
}

func (s *Server) handleJobLogs(w http.ResponseWriter, r *http.Request, jobID int64) {
	logs := s.Mgr.GetJobLogBuffer(jobID)
	if logs == nil {
		http.Error(w, "logs not available", 404)
		return
	}

	w.Header().Set("Content-Type", "application/octet-stream")
	_, _ = w.Write(logs)
}

// Download a single file
func (s *Server) handleDownloadArtifact(w http.ResponseWriter, r *http.Request, jobID int64, fid int64) {
	// Try file
	if f, err := store.GetJobFileByID(s.DB, fid); err == nil {
		if f.JobID != jobID {
			http.Error(w, "file not part of job", 404)
			return
		}
		// Security: ensure path is under watch dir
		rel, err := filepath.Rel(s.Cfg.WatchDir, f.Path)
		if err != nil || strings.HasPrefix(rel, "..") {
			http.Error(w, "invalid path", 400)
			return
		}
		// Force download with proper headers
		setDownloadHeaders(w, f.Path)
		http.ServeFile(w, r, f.Path)
		return
	}
	http.NotFound(w, r)
}

func (s *Server) deleteJobArtifacts(jobID int64) error {
	files, err := store.ListJobFiles(s.DB, jobID)
	if err != nil {
		return err
	}
	var errs []string

	// Delete files
	for _, f := range files {
		rel, err := filepath.Rel(s.Cfg.WatchDir, f.Path)
		if err != nil || strings.HasPrefix(rel, "..") {
			errs = append(errs, fmt.Sprintf("refuse to remove file outside watch dir: %s", f.Path))
			continue
		}
		if err := os.Remove(f.Path); err != nil && !os.IsNotExist(err) {
			errs = append(errs, fmt.Sprintf("remove file %s: %v", f.Path, err))
		}
	}

	if len(errs) > 0 {
		return fmt.Errorf("errors removing artifacts: %s", strings.Join(errs, "; "))
	}

	return nil
}

func (s *Server) handleDeleteFiles(w http.ResponseWriter, r *http.Request, jobID int64) {
	if err := s.deleteJobArtifacts(jobID); err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// State websocket: broadcasts job/file metadata updates to all clients
func (s *Server) handleStateWS(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	ch := s.Mgr.SubscribeState()
	defer s.Mgr.UnsubscribeState(ch)

	for b := range ch {
		if err := conn.WriteMessage(websocket.TextMessage, b); err != nil {
			return
		}
	}
}
