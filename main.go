package main

import (
	"archive/zip"
	"database/sql"
	"embed"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"log"
	"mime"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/websocket"
	_ "github.com/mattn/go-sqlite3"

	"low-tide/config"
	"low-tide/jobs"
	"low-tide/store"
)

// helper to create a safe Content-Disposition header with both filename and filename*
func contentDisposition(filename string) string {
	base := filepath.Base(filename)
	// sanitize simple problematic characters
	safe := strings.Map(func(r rune) rune {
		if r == '\\' || r == '"' || r == '\n' || r == '\r' || r == '/' || r == '\x00' {
			return '_'
		}
		return r
	}, base)
	escaped := url.PathEscape(base)
	return fmt.Sprintf("attachment; filename=\"%s\"; filename*=UTF-8''%s", safe, escaped)
}

func setDownloadHeaders(w http.ResponseWriter, filename string) {
	w.Header().Set("Content-Disposition", contentDisposition(filename))
	if ext := filepath.Ext(filename); ext != "" {
		if mt := mime.TypeByExtension(ext); mt != "" {
			w.Header().Set("Content-Type", mt)
		}
	}
}

//go:embed templates/*.html
var templatesFS embed.FS

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

type Server struct {
	DB  *sql.DB
	Cfg *config.Config
	Mgr *jobs.Manager
}

// loggingMiddleware logs basic request information for every HTTP request.
func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		log.Printf("%s %s from %s", r.Method, r.URL.Path, r.RemoteAddr)
		next.ServeHTTP(w, r)
		log.Printf("%s %s done in %s", r.Method, r.URL.Path, time.Since(start))
	})
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
	mux.HandleFunc("/api/apps", srv.handleApps)
	mux.HandleFunc("/api/jobs", srv.handleJobs)
	mux.HandleFunc("/api/jobs/clear", srv.handleClearJobs)
	mux.HandleFunc("/api/jobs/", srv.handleJobAction)
	mux.HandleFunc("/ws/logs", srv.handleLogsWS)
	mux.HandleFunc("/ws/state", srv.handleStateWS)
	mux.HandleFunc("/api/current", srv.handleCurrent)

	log.Printf("Low Tide listening on %s", cfg.ListenAddr)
	log.Fatal(http.ListenAndServe(cfg.ListenAddr, loggingMiddleware(mux)))
}

func (s *Server) handleIndex(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	data, err := templatesFS.ReadFile("templates/index.html")
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write(data)
}

func (s *Server) handleApps(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	type appInfo struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	}
	var out []appInfo
	// include an "auto" option first
	out = append(out, appInfo{ID: "auto", Name: "Auto-detect"})
	for _, a := range s.Cfg.Apps {
		out = append(out, appInfo{ID: a.ID, Name: a.Name})
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(out)
}

func (s *Server) handleJobs(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		archived := r.URL.Query().Get("archived") == "1"
		jobsList, err := store.ListJobs(s.DB, archived, 100)
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		// annotate has_files and counts
		type jobWithFiles struct {
			store.Job
			HasFiles  bool `json:"has_files"`
			FileCount int  `json:"file_count"`
			DirCount  int  `json:"dir_count"`
		}
		out := make([]jobWithFiles, 0, len(jobsList))
		for _, j := range jobsList {
			fCount, dCount, err := store.CountJobArtifacts(s.DB, j.ID)
			if err != nil {
				http.Error(w, err.Error(), 500)
				return
			}
			out = append(out, jobWithFiles{Job: j, HasFiles: fCount+dCount > 0, FileCount: fCount, DirCount: dCount})
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
			s.Mgr.BroadcastState(jobs.JobUpdateEvent{Type: "job_update", JobID: jid, Status: string(store.StatusQueued)})
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

func splitURLs(s string) []string {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	lines := strings.Split(s, "\n")
	var out []string
	for _, line := range lines {
		fields := strings.Fields(line)
		out = append(out, fields...)
	}
	uniq := make([]string, 0, len(out))
	seen := map[string]struct{}{}
	for _, u := range out {
		if u == "" {
			continue
		}
		if _, ok := seen[u]; ok {
			continue
		}
		seen[u] = struct{}{}
		uniq = append(uniq, u)
	}
	return uniq
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
	// delete logs for archived jobs
	_ = store.DeleteLogsForArchivedJobs(s.DB)
	// broadcast state change that jobs were archived
	s.Mgr.BroadcastState(jobs.JobsArchivedEvent{Type: "jobs_archived"})
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleJobAction(w http.ResponseWriter, r *http.Request) {
	// /api/jobs/{id}/action or /api/jobs/{id}/files/{fileid}
	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/jobs/"), "/")
	if len(parts) < 2 {
		http.NotFound(w, r)
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
		w.WriteHeader(http.StatusNoContent)
	case "zip":
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		s.handleZip(w, r, id)
	case "files":
		// If URL is /api/jobs/{id}/files -> list (GET) or delete (DELETE)
		if len(parts) == 2 {
			switch r.Method {
			case http.MethodGet:
				s.handleListJobFiles(w, r, id)
			case http.MethodDelete:
				s.handleDeleteFiles(w, r, id)
			default:
				w.WriteHeader(http.StatusMethodNotAllowed)
			}
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
	case "logs":
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		s.handleListJobLogs(w, r, id)
		return
	case "archive":
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		if err := store.ArchiveJob(s.DB, id); err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		// delete logs for this job
		_ = store.DeleteJobLogs(s.DB, id)
		// broadcast state change
		s.Mgr.BroadcastState(jobs.JobUpdateEvent{Type: "job_update", JobID: id, Status: "archived"})
		w.WriteHeader(http.StatusNoContent)
		return
	case "delete":
		// Delete = archive + delete files + delete logs
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		if err := store.ArchiveJob(s.DB, id); err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		// Remove files/dirs from disk (only recorded artifacts)
		if err := s.deleteJobArtifacts(id); err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		// Remove DB rows for files/dirs and logs
		if err := store.DeleteJobFilesAndDirs(s.DB, id); err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		if err := store.DeleteJobLogs(s.DB, id); err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		// broadcast state change
		s.Mgr.BroadcastState(jobs.JobUpdateEvent{Type: "job_update", JobID: id, Status: "archived"})
		w.WriteHeader(http.StatusNoContent)
		return
	default:
		http.NotFound(w, r)
	}
}

func (s *Server) handleZip(w http.ResponseWriter, r *http.Request, jobID int64) {
	files, dirs, err := store.GetJobPaths(s.DB, jobID)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	if len(files) == 0 && len(dirs) == 0 {
		http.Error(w, "no files for job", 404)
		return
	}

	// If there's a single file and no dirs, serve it directly (shortcut)
	if len(files) == 1 && len(dirs) == 0 {
		f := files[0]
		// Force download with the original filename
		setDownloadHeaders(w, f.Path)
		http.ServeFile(w, r, f.Path)
		return
	}

	// Prepare zip download
	setDownloadHeaders(w, fmt.Sprintf("job-%d.zip", jobID))

	zw := newZipWriter(w, s.Cfg.WatchDir)
	defer zw.Close()

	for _, d := range dirs {
		if err := zw.AddDirWithRoot(d.Path); err != nil {
			log.Printf("zip dir %s: %v", d.Path, err)
		}
	}
	for _, f := range files {
		if err := zw.AddFile(f.Path); err != nil {
			log.Printf("zip file %s: %v", f.Path, err)
		}
	}
}

// List files for a job (paths are returned relative to watch root; no dirs).
func (s *Server) handleListJobFiles(w http.ResponseWriter, r *http.Request, jobID int64) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
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
			// Never leak absolute paths; if we can't make this relative, omit it.
			continue
		}
		rel = append(rel, f)
	}
	type resp struct {
		Files []store.JobFile `json:"files"`
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp{Files: rel})
}

// toRelPath trims the watch root prefix and returns a leading slash path.
func toRelPath(root, abs string) string {
	rel, err := filepath.Rel(root, abs)
	if err != nil {
		return ""
	}
	// If the path is outside the watch root, don't leak it.
	if rel == "." || strings.HasPrefix(rel, "..") {
		return ""
	}
	if !strings.HasPrefix(rel, string(os.PathSeparator)) {
		rel = string(os.PathSeparator) + rel
	}
	return rel
}

// List persisted logs for a job
func (s *Server) handleListJobLogs(w http.ResponseWriter, r *http.Request, jobID int64) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	logs, err := store.ListJobLogs(s.DB, jobID, 1000)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	type resp struct {
		Logs []store.JobLog `json:"logs"`
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp{Logs: logs})
}

// Download a single file or zip a directory
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
	// Try dir
	// If fid corresponds to a file id, it was handled above. Otherwise, treat
	// fid as a directory path id derived from current job files. Derive dirs from
	// GetJobPaths and match on a synthetic dir id.
	if _, dirs, err := store.GetJobPaths(s.DB, jobID); err == nil {
		for _, d := range dirs {
			if store.DirIDFromPath(d.Path) == fid {
				rel, err := filepath.Rel(s.Cfg.WatchDir, d.Path)
				if err != nil || strings.HasPrefix(rel, "..") {
					http.Error(w, "invalid path", 400)
					return
				}
				setDownloadHeaders(w, fmt.Sprintf("job-%d-dir-%d.zip", jobID, fid))
				zw := newZipWriter(w, s.Cfg.WatchDir)
				defer zw.Close()
				if err := zw.AddDirWithRoot(d.Path); err != nil {
					http.Error(w, err.Error(), 500)
					return
				}
				return
			}
		}
	}
	http.NotFound(w, r)
}

func (s *Server) deleteJobArtifacts(jobID int64) error {
	files, dirs, err := store.GetJobPaths(s.DB, jobID)
	if err != nil {
		return err
	}
	var errs []string

	// Delete files first
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

	// Then dirs, deepest first
	sort.Slice(dirs, func(i, j int) bool {
		return len(dirs[i].Path) > len(dirs[j].Path)
	})
	for _, d := range dirs {
		rel, err := filepath.Rel(s.Cfg.WatchDir, d.Path)
		if err != nil || strings.HasPrefix(rel, "..") {
			errs = append(errs, fmt.Sprintf("refuse to remove dir outside watch dir: %s", d.Path))
			continue
		}
		if err := os.RemoveAll(d.Path); err != nil && !os.IsNotExist(err) {
			errs = append(errs, fmt.Sprintf("remove dir %s: %v", d.Path, err))
		}
	}

	if len(errs) > 0 {
		return fmt.Errorf("errors removing artifacts: %s", strings.Join(errs, "; "))
	}

	if err := store.DeleteJobFilesAndDirs(s.DB, jobID); err != nil {
		return err
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

func (s *Server) handleLogsWS(w http.ResponseWriter, r *http.Request) {
	idStr := r.URL.Query().Get("id")
	if idStr == "" {
		http.Error(w, "missing id", 400)
		return
	}
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		http.Error(w, "invalid id", 400)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	ch := s.Mgr.SubscribeLogs(id)
	defer s.Mgr.UnsubscribeLogs(id, ch)

	for line := range ch {
		if err := conn.WriteMessage(websocket.TextMessage, []byte(line)); err != nil {
			return
		}
	}
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

// Return current running job id
func (s *Server) handleCurrent(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	id := s.Mgr.CurrentJobID()
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]int64{"current_job": id})
}

// zip helpers

type zipWriter struct {
	zw       *zip.Writer
	rootPath string
}

func newZipWriter(w http.ResponseWriter, root string) *zipWriter {
	return &zipWriter{zw: zip.NewWriter(w), rootPath: root}
}

func (z *zipWriter) AddFile(path string) error {
	rel, err := filepath.Rel(z.rootPath, path)
	if err != nil {
		return err
	}
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()
	info, err := f.Stat()
	if err != nil {
		return err
	}
	header, err := zip.FileInfoHeader(info)
	if err != nil {
		return err
	}
	header.Name = rel
	header.Method = zip.Deflate
	w, err := z.zw.CreateHeader(header)
	if err != nil {
		return err
	}
	_, err = io.Copy(w, f)
	return err
}

// AddDirWithRoot adds the contents of dir into the archive with dir's basename
// as the root path inside the zip (so parent folders are omitted).
func (z *zipWriter) AddDirWithRoot(dir string) error {
	base := filepath.Base(dir)
	return filepath.WalkDir(dir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		rel, err := filepath.Rel(dir, path)
		if err != nil {
			return err
		}
		f, err := os.Open(path)
		if err != nil {
			return err
		}
		defer f.Close()
		info, err := f.Stat()
		if err != nil {
			return err
		}
		header, err := zip.FileInfoHeader(info)
		if err != nil {
			return err
		}
		header.Name = filepath.Join(base, rel)
		header.Method = zip.Deflate
		w, err := z.zw.CreateHeader(header)
		if err != nil {
			return err
		}
		_, err = io.Copy(w, f)
		return err
	})
}

// AddDir is a compatibility wrapper that zips a directory using its basename as root.
func (z *zipWriter) AddDir(dir string) error {
	return z.AddDirWithRoot(dir)
}

func (z *zipWriter) Close() error {
	return z.zw.Close()
}
