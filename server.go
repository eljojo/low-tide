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

func NewServer(db *sql.DB, cfg *config.Config, mgr *jobs.Manager) *Server {
	return &Server{DB: db, Cfg: cfg, Mgr: mgr}
}

func (s *Server) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/", s.handleIndex)
	mux.Handle("/static/", http.FileServer(http.FS(assets)))
	mux.HandleFunc("/api/jobs", s.handleJobs)
	mux.HandleFunc("/api/jobs/", s.handleJobAction)
	mux.HandleFunc("/ws/state", s.handleStateWS)
	return loggingMiddleware(mux)
}

func (s *Server) handleIndex(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}

	// will be used to populate app list in JS
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
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(jobsList)
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

		isAuto := appID == "auto" || appID == ""

		// Create one job per URL (single-URL-per-job model)
		var ids []int64
		var errors []string

		for _, u := range urls {
			finalAppID := appID
			if isAuto {
				if a := s.Cfg.MatchAppForURL(u); a != nil {
					finalAppID = a.ID
				} else {
					log.Printf("/api/jobs: could not auto-match app for url=%q", u)
					errors = append(errors, fmt.Sprintf("could not auto-match app for url: %s", u))
					continue
				}
			}

			if s.Cfg.GetApp(finalAppID) == nil {
				log.Printf("/api/jobs unknown app_id=%q for url=%q", finalAppID, u)
				errors = append(errors, fmt.Sprintf("unknown app_id=%q for url: %s", finalAppID, u))
				continue
			}

			jid, err := store.InsertJob(s.DB, finalAppID, u, time.Now())
			if err != nil {
				errors = append(errors, fmt.Sprintf("failed to insert job for %s: %v", u, err))
				continue
			}
			ids = append(ids, jid)
			s.Mgr.Queue <- jid
			s.Mgr.BroadcastJobSnapshot(jid)
			go s.Mgr.FetchAndSaveTitle(jid, u)
		}

		if len(ids) == 0 && len(errors) > 0 {
			http.Error(w, strings.Join(errors, "; "), 400)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"ids": ids})
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

func (s *Server) handleJobAction(w http.ResponseWriter, r *http.Request) {
	// /api/jobs/{id}/{action} or /api/jobs/{id}/files/{fileid}
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
			s.handleGetJobSnapshot(w, r, id)
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
		// If URL is /api/jobs/{id}/files -> manage files
		// e.g. DELETE to remove all files for job
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
		s.Mgr.BroadcastJobSnapshot(id)
		w.WriteHeader(http.StatusNoContent)
		return
	case "cleanup":
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		if err := store.MarkJobCleaned(s.DB, id); err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		if err := s.deleteJobArtifacts(id); err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		s.Mgr.BroadcastJobSnapshot(id)
		w.WriteHeader(http.StatusNoContent)
		return
	default:
		http.NotFound(w, r)
	}
}

func (s *Server) handleZip(w http.ResponseWriter, r *http.Request, jobID int64) {
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
	if len(files) == 0 {
		http.Error(w, "no files for job", 404)
		return
	}

	jobDir := filepath.Join(s.Cfg.DownloadsDir, fmt.Sprintf("%d", jobID))

	safeTitle := parameterize(j.Title, fmt.Sprintf("job-%d", jobID))
	setDownloadHeaders(w, safeTitle+".zip")

	zw := newZipWriter(w, jobDir)
	defer zw.Close()

	for _, f := range files {
		if err := zw.AddFile(f.Path); err != nil {
			log.Printf("zip file %s: %v", f.Path, err)
		}
	}
}

func (s *Server) handleGetJobSnapshot(w http.ResponseWriter, r *http.Request, jobID int64) {
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

	jobDir := filepath.Join(s.Cfg.DownloadsDir, fmt.Sprintf("%d", jobID))

	rel := make([]store.JobFile, 0, len(files))
	for _, f := range files {
		f.Path = toRelPath(jobDir, f.Path)
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

func (s *Server) handleDownloadArtifact(w http.ResponseWriter, r *http.Request, jobID int64, fid int64) {
	if f, err := store.GetJobFileByID(s.DB, fid); err == nil {
		if f.JobID != jobID {
			http.Error(w, "file not part of job", 404)
			return
		}

		jobDir := filepath.Join(s.Cfg.DownloadsDir, fmt.Sprintf("%d", jobID))
		absJobDir, err := filepath.Abs(jobDir)
		if err != nil {
			http.Error(w, "internal error", 500)
			return
		}

		// Security: ensure path is under the job's downloads dir
		rel, err := filepath.Rel(absJobDir, f.Path)
		if err != nil || strings.HasPrefix(rel, "..") {
			http.Error(w, "invalid path", 400)
			return
		}
		setDownloadHeaders(w, f.Path)
		http.ServeFile(w, r, f.Path)
		return
	}
	http.NotFound(w, r)
}

func (s *Server) deleteJobArtifacts(jobID int64) error {
	jobDir := filepath.Join(s.Cfg.DownloadsDir, fmt.Sprintf("%d", jobID))
	absJobDir, err := filepath.Abs(jobDir)
	if err != nil {
		return err
	}
	absDownloadsDir, err := filepath.Abs(s.Cfg.DownloadsDir)
	if err != nil {
		return err
	}

	// Security: ensure jobDir is inside downloadsDir
	rel, err := filepath.Rel(absDownloadsDir, absJobDir)
	if err != nil || strings.HasPrefix(rel, "..") {
		return fmt.Errorf("refuse to remove folder outside downloads dir: %s", absJobDir)
	}

	if err := os.RemoveAll(absJobDir); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to remove job directory %s: %v", absJobDir, err)
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
