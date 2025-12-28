// SPDX-License-Identifier: AGPL-3.0-only
package jobs

import (
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/fsnotify/fsnotify"
	"low-tide/store"
)

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

	// Skip files that were already present at job start
	if m.isInBaseline(absPath) {
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

// toRel converts an absolute path to a path relative to the watch root.
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

// snapshotFiles captures the existing files before a job starts (aka the baseline).
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
			if _, ok := cur.baseline[fullPath]; ok { // skip if in baseline
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
