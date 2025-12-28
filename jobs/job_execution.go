// SPDX-License-Identifier: AGPL-3.0-only
package jobs

import (
	"context"
	"fmt"
	"io"
	"log"
	"low-tide/internal/terminal"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/creack/pty"
	"low-tide/config"
	"low-tide/internal/chars"
	"low-tide/store"
)

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

	// check to see if any output files were created
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

func (m *Manager) CurrentJobID() int64 {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.current == nil {
		return 0
	}
	return m.current.jobID
}

// isInBaseline reports whether the given path existed before the current job started.
func (m *Manager) isInBaseline(path string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.current == nil || m.current.baseline == nil {
		return false
	}
	_, ok := m.current.baseline[path]
	return ok
}
