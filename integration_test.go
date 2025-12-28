// SPDX-License-Identifier: AGPL-3.0-only
package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	_ "github.com/mattn/go-sqlite3"

	"low-tide/config"
	"low-tide/jobs"
	"low-tide/store"
)

func TestIntegration_DownloadFlow(t *testing.T) {
	// 1. Setup temporary workspace
	tmpDir, err := os.MkdirTemp("", "lowtide-test-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tmpDir)

	dbPath := filepath.Join(tmpDir, "test.db")
	watchDir := filepath.Join(tmpDir, "downloads")
	err = os.MkdirAll(watchDir, 0755)
	if err != nil {
		t.Fatal(err)
	}

	// 2. Setup dummy HTTP server to serve a file
	dummyContent := "hello world from integration test"
	dummyServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, dummyContent)
	}))
	defer dummyServer.Close()

	// 3. Setup Low Tide Server
	db, err := sql.Open("sqlite3", dbPath+"?_fk=1")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	if err := store.Init(db); err != nil {
		t.Fatal(err)
	}

	cfg := &config.Config{
		ListenAddr: "127.0.0.1:0", // not used by httptest
		DBPath:     dbPath,
		WatchDir:   watchDir,
		Apps: []config.AppConfig{
			{
				ID:      "test-curl",
				Name:    "Test Curl",
				Command: "curl",
				Args:    []string{"-o", "testfile.txt", "%u"},
			},
		},
	}

	mgr, err := jobs.NewManager(db, cfg)
	if err != nil {
		t.Fatal(err)
	}

	srv := NewServer(db, cfg, mgr)
	ts := httptest.NewServer(srv.Routes())
	defer ts.Close()

	// 4. Connect to WebSocket
	wsURL := "ws" + strings.TrimPrefix(ts.URL, "http") + "/ws/state"
	dialer := websocket.DefaultDialer
	conn, _, err := dialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("failed to dial ws: %v", err)
	}
	defer conn.Close()

	wsMsgs := make(chan []byte, 10)
	go func() {
		for {
			_, message, err := conn.ReadMessage()
			if err != nil {
				close(wsMsgs)
				return
			}
			wsMsgs <- message
		}
	}()

	// 5. Trigger Job via API
	resp, err := http.PostForm(ts.URL+"/api/jobs", url.Values{
		"app_id": {"test-curl"},
		"urls":   {dummyServer.URL},
	})
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("POST /api/jobs failed: %d %s", resp.StatusCode, string(body))
	}

	var postResult struct {
		IDs []int64 `json:"ids"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&postResult); err != nil {
		t.Fatal(err)
	}

	if len(postResult.IDs) != 1 {
		t.Fatalf("expected 1 job ID, got %v", postResult.IDs)
	}
	jobID := postResult.IDs[0]

	// 6. Wait for job to complete (polling or waiting for WS)
	timeout := time.After(10 * time.Second)
	completed := false
	for !completed {
		select {
		case msg, ok := <-wsMsgs:
			if !ok {
				t.Fatal("ws closed unexpectedly")
			}
			var ev struct {
				Type string     `json:"type"`
				Job  *store.Job `json:"job"`
			}
			if err := json.Unmarshal(msg, &ev); err != nil {
				continue
			}
			if ev.Type == "job_snapshot" && ev.Job != nil && ev.Job.ID == jobID {
				if ev.Job.Status == store.StatusSuccess || ev.Job.Status == store.StatusFailed {
					if ev.Job.Status == store.StatusFailed {
						t.Fatalf("job failed: %s", *ev.Job.ErrorMessage)
					}
					completed = true
				}
			}
		case <-timeout:
			t.Fatal("timeout waiting for job to complete")
		}
	}

	// 7. Verify file exists and content matches
	filePath := filepath.Join(watchDir, "testfile.txt")
	content, err := os.ReadFile(filePath)
	if err != nil {
		t.Fatalf("failed to read downloaded file: %v", err)
	}
	if string(content) != dummyContent {
		t.Fatalf("content mismatch: expected %q, got %q", dummyContent, string(content))
	}

	// 8. Verify metadata in DB
	j, err := store.GetJob(db, jobID)
	if err != nil {
		t.Fatal(err)
	}
	if j.Status != store.StatusSuccess {
		t.Fatalf("expected status success, got %s", j.Status)
	}

	files, err := store.ListJobFiles(db, jobID)
	if err != nil {
		t.Fatal(err)
	}
	if len(files) != 1 {
		t.Fatalf("expected 1 file in DB, got %d", len(files))
	}
	if !strings.HasSuffix(files[0].Path, "testfile.txt") {
		t.Fatalf("expected file path to end with testfile.txt, got %s", files[0].Path)
	}

	log.Printf("Integration test passed! Job %d finished successfully.", jobID)
}
