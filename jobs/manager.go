// SPDX-License-Identifier: AGPL-3.0-only
package jobs

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/creack/pty"
	"github.com/fsnotify/fsnotify"

	"low-tide/config"
	"low-tide/internal/chars"
	"low-tide/internal/terminal"
	"low-tide/store"
)

type Manager struct {
	DB        *sql.DB
	Cfg       *config.Config
	Watcher   *fsnotify.Watcher
	Queue     chan int64
	watchRoot string

	mu      sync.Mutex
	current *runningJob

	stateSubs      map[chan []byte]struct{}
	stateSubsMutex sync.Mutex

	jobChanges   map[int64]*jobChange
	jobChangesMu sync.Mutex
}

type jobChange struct {
	dirty    bool
	lastSent []byte
	seq      uint64
}

type runningJob struct {
	jobID     int64
	term      *terminal.Terminal
	startedAt time.Time
	baseline  map[string]struct{}
	pty       *os.File
	cmd       *exec.Cmd
	cancel    context.CancelFunc
}

type JobSnapshotEvent struct {
	Type string     `json:"type"`
	Job  *store.Job `json:"job,omitempty"`
	At   time.Time  `json:"updated_at"`
}

type JobLogEvent struct {
	Type  string         `json:"type"`
	JobID int64          `json:"job_id"`
	Lines map[int]string `json:"lines,omitempty"`
	When  time.Time      `json:"when"`
}

func NewManager(db *sql.DB, cfg *config.Config) (*Manager, error) {
	w, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, err
	}
	watchRoot, err := filepath.Abs(cfg.WatchDir)
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(watchRoot, 0o755); err != nil {
		return nil, err
	}
	if err := addRecursiveWatch(w, watchRoot); err != nil {
		return nil, err
	}

	m := &Manager{
		DB:         db,
		Cfg:        cfg,
		Watcher:    w,
		Queue:      make(chan int64, 128),
		stateSubs:  make(map[chan []byte]struct{}),
		jobChanges: make(map[int64]*jobChange),
		watchRoot:  watchRoot,
	}

	go m.watchLoop()
	log.Printf("job manager started; watching %s", watchRoot)
	go m.worker()
	go m.filesPublisher()
	go m.logPublisher()
	return m, nil
}

// filesPublisher emits job files snapshots at most every 100ms when marked dirty.
// worker processes queued job IDs sequentially.
func (m *Manager) worker() {
	for jobID := range m.Queue {
		if jobID == 0 {
			continue
		}
		m.runJob(jobID)
	}
}

func (m *Manager) filesPublisher() {
	t := time.NewTicker(100 * time.Millisecond)
	defer t.Stop()
	for range t.C {
		type workItem struct {
			jobID int64
			seq   uint64
		}

		m.jobChangesMu.Lock()
		items := make([]workItem, 0, len(m.jobChanges))
		for id, ch := range m.jobChanges {
			if ch == nil || !ch.dirty {
				continue
			}
			items = append(items, workItem{
				jobID: id,
				seq:   ch.seq,
			})
		}
		m.jobChangesMu.Unlock()

		for _, it := range items {
			m.BroadcastJobSnapshot(it.jobID)
			m.markClean(it.jobID, it.seq)
		}
	}
}

func (m *Manager) logPublisher() {
	t := time.NewTicker(50 * time.Millisecond)
	defer t.Stop()
	for range t.C {
		m.mu.Lock()
		rj := m.current
		m.mu.Unlock()
		if rj != nil {
			if delta := rj.term.GetDeltaHTML(); len(delta) > 0 {
				m.broadcastLogDelta(rj.jobID, delta)
			}
		}
	}
}

func (m *Manager) markDirty(jobID int64) {
	m.jobChangesMu.Lock()
	defer m.jobChangesMu.Unlock()
	ch := m.jobChanges[jobID]
	if ch == nil {
		ch = &jobChange{}
		m.jobChanges[jobID] = ch
	}
	ch.seq++
	ch.dirty = true
}

// markClean records the payload we just published and clears the dirty flag ONLY
// if no newer changes happened since we started rendering.
func (m *Manager) markClean(jobID int64, seq uint64) {
	m.jobChangesMu.Lock()
	defer m.jobChangesMu.Unlock()
	ch := m.jobChanges[jobID]
	if ch == nil {
		ch = &jobChange{}
		m.jobChanges[jobID] = ch
	}
	// Only clear if nothing changed while we were rendering/sending.
	if ch.seq == seq {
		ch.dirty = false
	}
}

func (m *Manager) toRel(abs string) string {
	if abs == "" {
		return ""
	}
	rel, err := filepath.Rel(m.watchRoot, abs)
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

func addRecursiveWatch(w *fsnotify.Watcher, root string) error {
	return filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			if err := w.Add(path); err != nil {
				return err
			}
		}
		return nil
	})
}

// snapshotFiles captures the existing files before a job starts.
func snapshotFiles(root string) map[string]struct{} {
	out := make(map[string]struct{})
	_ = filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if info.IsDir() {
			return nil
		}
		out[path] = struct{}{}
		return nil
	})
	return out
}

// watchLoop handles filesystem events and updates the DB immediately.
func (m *Manager) watchLoop() {
	for {
		select {
		case ev, ok := <-m.Watcher.Events:
			if !ok {
				return
			}
			// fsnotify is not recursive: we must add watches for newly created
			// directories, and we must also guard against the race where files are
			// created inside a new directory before the watch is added.
			if ev.Op&(fsnotify.Create|fsnotify.Write) != 0 {
				m.handleFileEvent(ev.Name)
			}
			if ev.Op&(fsnotify.Remove|fsnotify.Rename) != 0 {
				m.handleRemoveEvent(ev.Name)
			}
		case err, ok := <-m.Watcher.Errors:
			if !ok {
				return
			}
			log.Printf("fsnotify error: %v", err)
		}
	}
}

// handleFileEvent records or updates a file for the current job, or starts watching new directories.
func (m *Manager) handleFileEvent(path string) {
	absPath, err := filepath.Abs(path)
	if err != nil {
		return
	}
	info, err := os.Stat(absPath)
	if err != nil {
		// Can happen if file is deleted immediately after create
		return
	}

	jobID := m.CurrentJobID()

	if info.IsDir() {
		_ = addRecursiveWatch(m.Watcher, absPath)
		// If a job is running, scan this new directory immediately to close the race condition
		// where files are created before the watch is fully active.
		if jobID != 0 {
			go m.scanSiblings(jobID, absPath)
		}
		return
	}

	if jobID == 0 {
		return
	}

	if m.isBaseline(absPath) {
		return
	}

	exists, _ := store.JobFileExists(m.DB, jobID, absPath)
	if !exists {
		log.Printf("job %d: found new file: %s", jobID, m.toRel(absPath))
		// New file found: scan the directory for any other siblings we might have missed
		// (e.g. due to race conditions or missed events).
		go m.scanSiblings(jobID, filepath.Dir(absPath))
	}

	// upsert file immediately
	_ = store.InsertJobFile(m.DB, jobID, absPath, info.Size(), info.ModTime())
	m.markDirty(jobID)
}

// For running jobs we remove from the current job immediately. If no job is
// running, we best-effort remove the path across all jobs to avoid stale DB
func (m *Manager) handleRemoveEvent(path string) {
	absPath, err := filepath.Abs(path)
	if err != nil {
		return
	}

	jobID := m.CurrentJobID()
	if jobID == 0 {
		return
	}

	_ = store.DeleteJobFileByPath(m.DB, jobID, absPath)
	m.markDirty(jobID)
}

func (m *Manager) isBaseline(path string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.current == nil || m.current.baseline == nil {
		return false
	}
	_, ok := m.current.baseline[path]
	return ok
}

func (m *Manager) CurrentJobID() int64 {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.current == nil {
		return 0
	}
	return m.current.jobID
}

func (m *Manager) scanSiblings(jobID int64, dir string) {
	m.mu.Lock()
	cur := m.current
	m.mu.Unlock()

	if cur == nil || cur.jobID != jobID {
		return
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		return
	}

	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		fullPath := filepath.Join(dir, e.Name())
		if cur.baseline != nil {
			if _, ok := cur.baseline[fullPath]; ok {
				continue
			}
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		_ = store.InsertJobFile(m.DB, jobID, fullPath, info.Size(), info.ModTime())
	}
	m.markDirty(jobID)
}

func (m *Manager) runJob(jobID int64) {
	j, err := store.GetJob(m.DB, jobID)
	if err != nil {
		log.Printf("worker: GetJob(%d) error: %v", jobID, err)
		return
	}
	log.Printf("worker: running job %d (status: %s)", jobID, j.Status)

	baseline := snapshotFiles(m.watchRoot)
	ctx := &runningJob{
		jobID:     jobID,
		startedAt: time.Now(),
		baseline:  baseline,
		term:      terminal.New(500),
	}
	m.mu.Lock()
	m.current = ctx
	m.mu.Unlock()

	_ = store.UpdateJobStatusRunning(m.DB, jobID, ctx.startedAt)
	m.markDirty(jobID)
	m.BroadcastJobSnapshot(jobID)

	var failureMsg string
	success := true

	// Initial resync to catch any files created between snapshotFiles (baseline) and now.
	if err := m.resyncJobFiles(jobID, baseline); err != nil {
		log.Printf("worker: initial resync job %d error: %v", jobID, err)
	}

	appCfg := m.Cfg.GetApp(j.AppID)
	if appCfg == nil {
		log.Printf("worker: job %d failed, unknown app %s", jobID, j.AppID)
		failureMsg = "unknown app: " + j.AppID
		success = false
		m.BroadcastJobSnapshot(jobID)
		m.clearCurrent(jobID, ctx)
		return
	}

	if j.URL != "" {
		err := m.runSingleURL(ctx, appCfg, j.URL)
		if err != nil {
			success = false
			failureMsg = err.Error()
		}
	}

	// Final resync with filesystem: include files created during this job only.
	if err := m.resyncJobFiles(jobID, baseline); err != nil {
		log.Printf("worker: resync job %d error: %v", jobID, err)
	}

	if success && failureMsg == "" {
		files, err := store.ListJobFiles(m.DB, jobID)
		if err != nil {
			log.Printf("worker: list files error: %v", err)
		} else {
			hasContent := false
			for _, f := range files {
				if f.SizeBytes > 0 {
					hasContent = true
					break
				}
			}
			if !hasContent {
				success = false
				failureMsg = "no output files found (or all empty)"
			}
		}
	}

	// Heuristic to update title if it's generic
	if success && (strings.Contains(j.Title, "http") || strings.Contains(j.Title, "www.") || j.Title == "") {
		files, _ := store.ListJobFiles(m.DB, jobID)
		if len(files) == 1 {
			base := filepath.Base(files[0].Path)
			ext := filepath.Ext(base)
			newTitle := strings.TrimSuffix(base, ext)
			_ = store.UpdateJobTitle(m.DB, jobID, newTitle)
		}
	}

	finished := time.Now()
	duration := finished.Sub(ctx.startedAt).Round(time.Second)

	if success {
		summaryLine := chars.NewLine + fmt.Sprintf("\x1b[1;32m✅ --- Job finished: Success (ran for %v) ---\x1b[0m", duration) + chars.NewLine
		m.appendAndBroadcastLog(ctx, []byte(summaryLine))
		_ = store.MarkJobSuccess(m.DB, jobID, finished, ctx.term.RenderHTML())
	} else if failureMsg == "cancelled" {
		summaryLine := chars.NewLine + fmt.Sprintf("\x1b[1;33m⏹️ --- Job CANCELLED (ran for %v) ---\x1b[0m", duration) + chars.NewLine
		m.appendAndBroadcastLog(ctx, []byte(summaryLine))
		_ = store.MarkJobCancelled(m.DB, jobID, finished, ctx.term.RenderHTML())
	} else if failureMsg == "signal: killed" {
		summaryLine := chars.NewLine + fmt.Sprintf("\x1b[1;31m🛑 --- Job KILLED (ran for %v) ---\x1b[0m", duration) + chars.NewLine
		m.appendAndBroadcastLog(ctx, []byte(summaryLine))
		_ = store.MarkJobCancelled(m.DB, jobID, finished, ctx.term.RenderHTML())
	} else {
		summaryLine := chars.NewLine + fmt.Sprintf("\x1b[1;31m❌ --- Job finished: Failed (%s) (ran for %v) ---\x1b[0m", failureMsg, duration) + chars.NewLine
		m.appendAndBroadcastLog(ctx, []byte(summaryLine))
		_ = store.MarkJobFailed(m.DB, jobID, finished, failureMsg, ctx.term.RenderHTML())
	}

	m.BroadcastJobSnapshot(jobID)
	m.clearCurrent(jobID, ctx)
}

func (m *Manager) appendAndBroadcastLog(rj *runningJob, data []byte) {
	rj.term.Write(data) // Ticker will pick up the changes
}

func (m *Manager) resyncJobFiles(jobID int64, baseline map[string]struct{}) error {
	existing, err := store.ListJobFiles(m.DB, jobID)
	if err != nil {
		return err
	}
	existingMap := make(map[string]store.JobFile, len(existing))
	for _, f := range existing {
		existingMap[f.Path] = f
	}

	seen := make(map[string]struct{})
	err = filepath.Walk(m.watchRoot, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if info.IsDir() {
			return nil
		}
		if baseline != nil {
			if _, ok := baseline[path]; ok {
				return nil
			}
		}
		seen[path] = struct{}{}
		return store.InsertJobFile(m.DB, jobID, path, info.Size(), info.ModTime())
	})
	if err != nil {
		return err
	}

	for p := range existingMap {
		if _, ok := seen[p]; !ok {
			_ = store.DeleteJobFileByPath(m.DB, jobID, p)
		}
	}

	m.markDirty(jobID)
	return nil
}

func (m *Manager) clearCurrent(jobID int64, ctx *runningJob) {
	m.mu.Lock()
	if m.current == ctx {
		m.current = nil
	}
	m.mu.Unlock()
}

func (m *Manager) CancelJob(jobID int64) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.current == nil || m.current.jobID != jobID {
		return fmt.Errorf("job %d is not running", jobID)
	}
	if m.current.cancel != nil {
		m.current.cancel()
	}
	if m.current.pty != nil {
		// Send SIGTERM to the process group if possible, or just the process
		_ = m.current.pty.Close()
	}
	if m.current.cmd != nil && m.current.cmd.Process != nil {
		log.Printf("CancelJob %d: killing process %d", jobID, m.current.cmd.Process.Pid)
		_ = m.current.cmd.Process.Kill()
	}
	return nil
}

func (m *Manager) runSingleURL(rj *runningJob, app *config.AppConfig, url string) error {
	if app.StripTrailingSlash && strings.HasSuffix(url, "/") {
		url = strings.TrimSuffix(url, "/")
	}

	args := make([]string, 0, len(app.Args))
	for _, a := range app.Args {
		args = append(args, strings.ReplaceAll(a, "%u", url))
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	rj.cancel = cancel

	cmd := exec.CommandContext(ctx, app.Command, args...)
	cmd.Env = os.Environ()
	cmd.Dir = m.Cfg.WatchDir
	// Tell apps we are a terminal
	cmd.Env = append(cmd.Env, "TERM=xterm-256color")
	rj.cmd = cmd

	f, err := pty.Start(cmd)
	if err != nil {
		return err
	}
	rj.pty = f
	defer f.Close()

	// Set terminal size
	_ = pty.Setsize(f, &pty.Winsize{Rows: 24, Cols: 100})

	pid := cmd.Process.Pid
	_ = store.UpdateJobPID(m.DB, rj.jobID, pid)

	cmdLine := fmt.Sprintf("%s %s", app.Command, strings.Join(args, " "))
	firstLine := "$ " + cmdLine + chars.NewLine + chars.CRLF
	m.appendAndBroadcastLog(rj, []byte(firstLine))

	go m.streamRaw(ctx, rj.jobID, f, rj)

	err = cmd.Wait()
	exitCode := -1
	if cmd.ProcessState != nil {
		exitCode = cmd.ProcessState.ExitCode()
	}
	_ = store.ClearJobPID(m.DB, rj.jobID, exitCode)

	m.mu.Lock()
	if m.current == rj {
		rj.pty = nil
	}
	m.mu.Unlock()

	if ctx.Err() != nil {
		return fmt.Errorf("cancelled")
	}

	if err != nil {
		return err
	}
	return nil
}

func (m *Manager) streamRaw(ctx context.Context, jobID int64, r io.Reader, rj *runningJob) {
	buf := make([]byte, 32*1024)
	for {
		select {
		case <-ctx.Done():
			return
		default:
			n, err := r.Read(buf)
			if n > 0 {
				data := make([]byte, n)
				copy(data, buf[:n])
				m.appendAndBroadcastLog(rj, data)
			}
			if err != nil {
				return
			}
		}
	}
}

func (m *Manager) broadcastLogDelta(jobID int64, lines map[int]string) {
	ev := JobLogEvent{
		Type:  "job_log",
		JobID: jobID,
		Lines: lines,
		When:  time.Now(),
	}
	m.BroadcastState(ev)
}

func (m *Manager) SubscribeState() chan []byte {
	ch := make(chan []byte, 64)
	m.stateSubsMutex.Lock()
	m.stateSubs[ch] = struct{}{}
	m.stateSubsMutex.Unlock()
	return ch
}

func (m *Manager) UnsubscribeState(ch chan []byte) {
	m.stateSubsMutex.Lock()
	defer m.stateSubsMutex.Unlock()
	if _, ok := m.stateSubs[ch]; ok {
		delete(m.stateSubs, ch)
		close(ch)
	}
}

func (m *Manager) broadcastState(v interface{}) {
	b, err := json.Marshal(v)
	if err != nil {
		return
	}
	m.stateSubsMutex.Lock()
	subs := make([]chan []byte, 0, len(m.stateSubs))
	for ch := range m.stateSubs {
		subs = append(subs, ch)
	}
	m.stateSubsMutex.Unlock()
	for _, ch := range subs {
		select {
		case ch <- b:
		default:
		}
	}
}

func (m *Manager) BroadcastState(v interface{}) {
	m.broadcastState(v)
}

func (m *Manager) BroadcastJobSnapshot(jobID int64) {
	j, err := store.GetJob(m.DB, jobID)
	if err != nil {
		return
	}
	files, err := store.ListJobFiles(m.DB, jobID)
	if err != nil {
		return
	}
	relFiles := make([]store.JobFile, 0, len(files))
	for _, f := range files {
		f.Path = m.toRel(f.Path)
		if f.Path == "" {
			continue
		}
		relFiles = append(relFiles, f)
	}
	j.Files = relFiles

	ev := JobSnapshotEvent{Type: "job_snapshot", Job: j, At: time.Now()}
	m.BroadcastState(ev)
}

func (m *Manager) GetJobLogs(jobID int64) ([]byte, bool) {
	j, err := store.GetJob(m.DB, jobID)
	if err != nil {
		return nil, false
	}
	return []byte(j.Logs), true
}

func (m *Manager) GetJobLogBuffer(jobID int64) []byte {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.current == nil || m.current.jobID != jobID {
		// Fallback to recent logs
		if logs, ok := m.GetJobLogs(jobID); ok {
			return logs
		}
		return nil
	}
	return []byte(m.current.term.RenderHTML())
}
