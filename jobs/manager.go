package jobs

import (
	"bufio"
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

	"github.com/fsnotify/fsnotify"

	"low-tide/config"
	"low-tide/internal/chars"
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
	jobID       int64
	logBuf      []store.LogLine
	logBufLimit int
	startedAt   time.Time
	baseline    map[string]struct{}
}

type JobSnapshotEvent struct {
	Type string     `json:"type"`
	Job  *store.Job `json:"job,omitempty"`
	At   time.Time  `json:"updated_at"`
}

type JobLogEvent struct {
	Type  string    `json:"type"`
	JobID int64     `json:"job_id"`
	Line  string    `json:"line"`
	When  time.Time `json:"when"`
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

		// NOTE: avoid data races by only reading/writing jobChange fields while
		// holding jobChangesMu.
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

	if jobID := m.CurrentJobID(); jobID != 0 {
		_ = store.DeleteJobFileByPath(m.DB, jobID, absPath)
		m.markDirty(jobID)
		return
	}

	// No current job: delete across all jobs that recorded this exact path.
	rows, err := store.ListJobFilesByPath(m.DB, absPath)
	if err != nil {
		return
	}
	for _, f := range rows {
		_ = store.DeleteJobFileByPath(m.DB, f.JobID, absPath)
		m.markDirty(f.JobID)
	}
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
	log.Printf("worker: starting job %d", jobID)
	j, err := store.GetJob(m.DB, jobID)
	if err != nil {
		log.Printf("worker: GetJob(%d) error: %v", jobID, err)
		return
	}

	baseline := snapshotFiles(m.watchRoot)
	ctx := &runningJob{jobID: jobID, logBufLimit: 4000, startedAt: time.Now(), baseline: baseline}
	m.mu.Lock()
	m.current = ctx
	m.mu.Unlock()

	_ = store.UpdateJobStatusRunning(m.DB, jobID, ctx.startedAt)
	m.markDirty(jobID)
	m.BroadcastJobSnapshot(jobID)

	// Initial resync to catch any files created between snapshotFiles (baseline) and now.
	if err := m.resyncJobFiles(jobID, baseline); err != nil {
		log.Printf("worker: initial resync job %d error: %v", jobID, err)
	}

	appCfg := m.Cfg.GetApp(j.AppID)
	if appCfg == nil {
		log.Printf("worker: job %d failed, unknown app %s", jobID, j.AppID)
		_ = store.MarkJobFailed(m.DB, jobID, time.Now(), "unknown app: "+j.AppID)
		m.BroadcastJobSnapshot(jobID)
		m.clearCurrent(jobID, ctx)
		return
	}

	var failureMsg string
	success := true
	if j.URL != "" {
		err := m.runSingleURL(ctx, appCfg, j.URL)
		if err != nil {
			success = false
			failureMsg = err.Error()
			_ = store.MarkJobFailed(m.DB, jobID, time.Now(), failureMsg)
		}
	}

	// Final resync with filesystem: include files created during this job only.
	if err := m.resyncJobFiles(jobID, baseline); err != nil {
		log.Printf("worker: resync job %d error: %v", jobID, err)
	}

	if success {
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
				_ = store.MarkJobFailed(m.DB, jobID, time.Now(), failureMsg)
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
	if success {
		summaryLine := fmt.Sprintf("--- Job finished at %s: Success ---", finished.Format(time.RFC3339))
		m.appendAndBroadcastLog(ctx, summaryLine, finished)
		_ = store.MarkJobSuccess(m.DB, jobID, finished)
	} else {
		summaryLine := fmt.Sprintf("--- Job finished at %s: Failed (%s) ---", finished.Format(time.RFC3339), failureMsg)
		m.appendAndBroadcastLog(ctx, summaryLine, finished)
	}

	m.BroadcastJobSnapshot(jobID)
	m.clearCurrent(jobID, ctx)
}

func (m *Manager) appendAndBroadcastLog(rj *runningJob, line string, when time.Time) {
	entry := store.LogLine{Line: line, When: when}
	rj.appendLog(entry)
	m.broadcastLog(rj.jobID, line)
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
				return nil // existed before job
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
	if len(ctx.logBuf) > 0 {
		var lines []string
		for _, entry := range ctx.logBuf {
			lines = append(lines, entry.Line)
		}
		joined := strings.Join(lines, chars.NewLine)
		_ = store.UpdateJobLogs(m.DB, jobID, joined)
	}
	m.mu.Lock()
	if m.current == ctx {
		m.current = nil
	}
	m.mu.Unlock()
}

func (m *Manager) runSingleURL(rj *runningJob, app *config.AppConfig, url string) error {
	// Strip trailing slash if configured for this app
	if app.StripTrailingSlash && strings.HasSuffix(url, "/") {
		url = strings.TrimSuffix(url, "/")
	}

	args := make([]string, 0, len(app.Args))
	for _, a := range app.Args {
		args = append(args, strings.ReplaceAll(a, "%u", url))
	}

	cmd := exec.Command(app.Command, args...)
	cmd.Env = os.Environ()
	cmd.Dir = m.Cfg.WatchDir
	// TODO: this probably needs some shell escaping protection
	cmdLine := fmt.Sprintf("%s %s", app.Command, strings.Join(args, " "))
	log.Printf("job %d: running command: (dir=%s) %s", rj.jobID, cmd.Dir, cmdLine)
	firstLine := fmt.Sprintf("$ %s (dir=%s)", cmdLine, cmd.Dir)
	m.broadcastLog(rj.jobID, firstLine)
	rj.appendLog(store.LogLine{Line: firstLine, When: time.Now()})

	stdout, _ := cmd.StdoutPipe()
	stderr, _ := cmd.StderrPipe()

	if err := cmd.Start(); err != nil {
		log.Printf("job %d: failed to start command: %v", rj.jobID, err)
		return err
	}

	pid := cmd.Process.Pid
	_ = store.UpdateJobPID(m.DB, rj.jobID, pid)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go m.streamPipe(ctx, rj.jobID, stdout, rj)
	go m.streamPipe(ctx, rj.jobID, stderr, rj)

	err := cmd.Wait()
	exitCode := cmd.ProcessState.ExitCode()
	_ = store.ClearJobPID(m.DB, rj.jobID, exitCode)

	if err != nil {
		return err
	}
	return nil
}

func (m *Manager) streamPipe(ctx context.Context, jobID int64, r io.Reader, rj *runningJob) {
	sc := bufio.NewScanner(r)
	for sc.Scan() {
		select {
		case <-ctx.Done():
			return
		default:
			line := sc.Text()
			log.Printf("[job %d] %s", jobID, line)
			m.broadcastLog(jobID, line)
			entry := store.LogLine{Line: line, When: time.Now()}
			rj.appendLog(entry)
		}
	}
}

func (rj *runningJob) appendLog(entry store.LogLine) {
	if rj.logBufLimit <= 0 {
		return
	}
	if len(rj.logBuf) < rj.logBufLimit {
		rj.logBuf = append(rj.logBuf, entry)
	} else {
		copy(rj.logBuf, rj.logBuf[1:])
		rj.logBuf[len(rj.logBuf)-1] = entry
	}
}

func (m *Manager) broadcastLog(jobID int64, line string) {
	ev := JobLogEvent{Type: "job_log", JobID: jobID, Line: line, When: time.Now()}
	m.BroadcastState(ev)
}

// State subscription API
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

func (m *Manager) GetJobLogBuffer(jobID int64) []store.LogLine {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.current == nil || m.current.jobID != jobID {
		return nil
	}
	// Return a copy to avoid race
	out := make([]store.LogLine, len(m.current.logBuf))
	copy(out, m.current.logBuf)
	return out
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
			// Never leak absolute paths; if we can't make this relative, omit it.
			continue
		}
		relFiles = append(relFiles, f)
	}
	j.Files = relFiles

	m.mu.Lock()
	if m.current != nil && m.current.jobID == jobID {
		var lines []string
		for _, entry := range m.current.logBuf {
			lines = append(lines, entry.Line)
		}
		j.Logs = strings.Join(lines, chars.NewLine)
	}
	m.mu.Unlock()

	ev := JobSnapshotEvent{Type: "job_snapshot", Job: j, At: time.Now()}
	m.BroadcastState(ev)
}
