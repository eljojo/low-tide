// SPDX-License-Identifier: AGPL-3.0-only
package jobs

import (
	"bytes"
	"encoding/json"
	"time"

	"low-tide/store"
)

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

// logPublisher sends terminal log deltas at a regular interval.
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

func (m *Manager) BroadcastState(v interface{}) {
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

	// Marshal just the job data for comparison
	jobData, err := json.Marshal(j)
	if err != nil {
		return
	}

	m.jobChangesMu.Lock()
	ch := m.jobChanges[jobID]
	if ch == nil {
		m.jobChanges[jobID] = ch
	}

	// Compare with the last sent job data
	if bytes.Equal(ch.lastSent, jobData) {
		m.jobChangesMu.Unlock()
		return // Data is the same, no need to broadcast
	}

	// Data has changed, update our record of what was sent
	ch.lastSent = jobData
	m.jobChangesMu.Unlock()

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
