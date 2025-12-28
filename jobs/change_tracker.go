// SPDX-License-Identifier: AGPL-3.0-only
package jobs

import "time"

// jobChange tracks dirty state and last-sent payloads for job snapshots.
type jobChange struct {
	dirty    bool
	lastSent []byte
	seq      uint64
}

// filesPublisher emits job files snapshots at most every 100ms when marked dirty.
// It uses a seq number to avoid clearing the dirty flag if new changes occurred
// while we were rendering/sending the snapshot.
func (m *Manager) filesPublisher() {
	t := time.NewTicker(100 * time.Millisecond)
	defer t.Stop()

	type workItem struct {
		jobID int64
		seq   uint64
	}

	for range t.C {
		m.jobChangesMu.Lock()
		items := make([]workItem, 0, len(m.jobChanges))
		for id, ch := range m.jobChanges {
			if ch == nil || !ch.dirty {
				continue
			}
			items = append(items, workItem{jobID: id, seq: ch.seq})
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
