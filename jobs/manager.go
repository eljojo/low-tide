// SPDX-License-Identifier: AGPL-3.0-only
package jobs

import (
	"context"
	"database/sql"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"time"

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

type runningJob struct {
	jobID     int64
	term      *terminal.Terminal
	startedAt time.Time
	baseline  map[string]struct{}
	pty       *os.File
	cmd       *exec.Cmd
	cancel    context.CancelFunc
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
		stateSubs:  make(map[chan []byte]struct{}), // used for websocket subscribers
		jobChanges: make(map[int64]*jobChange),     // used to keep track of dirty jobs
		watchRoot:  watchRoot,
	}

	go m.watchLoop()
	log.Printf("job manager started; watching %s", watchRoot)
	go m.worker()
	go m.filesPublisher()
	go m.logPublisher()
	return m, nil
}

// worker processes queued job IDs sequentially.
func (m *Manager) worker() {
	for jobID := range m.Queue {
		if jobID == 0 {
			continue
		}
		m.runJob(jobID)
	}
}

// runs on startup
func (m *Manager) RecoverJobs() {
	running, err := store.ListJobsByStatus(m.DB, store.StatusRunning)
	if err != nil {
		log.Fatalf("recovery: failed to list running jobs: %v", err)
	} else {
		for _, j := range running {
			log.Printf("recovery: marking running job %d as cancelled", j.ID)
			finished := time.Now()
			// We don't have the terminal state, so we just use the existing logs if any
			_ = store.MarkJobCancelled(m.DB, j.ID, finished, j.Logs+chars.NewLine+"[SYSTEM] Job cancelled due to server restart.")
		}
	}

	queued, err := store.ListJobsByStatus(m.DB, store.StatusQueued)
	if err != nil {
		log.Fatalf("recovery: failed to list queued jobs: %v", err)
	} else {
		for _, j := range queued {
			log.Printf("recovery: re-queuing job %d", j.ID)
			m.Queue <- j.ID
		}
	}
}

func (m *Manager) clearCurrent(jobID int64, ctx *runningJob) {
	m.mu.Lock()
	if m.current == ctx {
		m.current = nil
	}
	m.mu.Unlock()
}
