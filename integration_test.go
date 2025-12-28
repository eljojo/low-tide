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
	downloadsDir := filepath.Join(tmpDir, "downloads")
	err = os.MkdirAll(downloadsDir, 0755)
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
		ListenAddr:   "127.0.0.1:0", // not used by httptest
		DBPath:       dbPath,
		DownloadsDir: downloadsDir,
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
	filePath := filepath.Join(downloadsDir, fmt.Sprintf("%d", jobID), "testfile.txt")
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

	// 9. Verify Slugification (parameterize)
	// We'll test this by checking the zip endpoint response header
	// First, update job title to something with spaces
	newTitle := "My Test Job With Spaces"
	err = store.UpdateJobTitle(db, jobID, newTitle)
	if err != nil {
		t.Fatal(err)
	}

	zipResp, err := http.Get(ts.URL + fmt.Sprintf("/api/jobs/%d/zip", jobID))
	if err != nil {
		t.Fatal(err)
	}
	defer zipResp.Body.Close()

	cd := zipResp.Header.Get("Content-Disposition")
	if !strings.Contains(cd, "my-test-job-with-spaces.zip") {
		t.Fatalf("expected slugified filename in Content-Disposition, got %q", cd)
	}

	log.Printf("Integration test passed! Job %d finished successfully.", jobID)
}

func TestIntegration_Cancellation(t *testing.T) {
	tmpDir, _ := os.MkdirTemp("", "lowtide-cancel-*")
	defer os.RemoveAll(tmpDir)

	dbPath := filepath.Join(tmpDir, "test.db")
	downloadsDir := filepath.Join(tmpDir, "downloads")
	os.MkdirAll(downloadsDir, 0755)

	db, _ := sql.Open("sqlite3", dbPath+"?_fk=1")
	defer db.Close()
	store.Init(db)

	cfg := &config.Config{
		DBPath:       dbPath,
		DownloadsDir: downloadsDir,
		Apps:         []config.AppConfig{{ID: "sleep", Command: "sleep", Args: []string{"10"}}},
	}
	mgr, _ := jobs.NewManager(db, cfg)
	srv := NewServer(db, cfg, mgr)
	ts := httptest.NewServer(srv.Routes())
	defer ts.Close()

	// Start job
	resp, _ := http.PostForm(ts.URL+"/api/jobs", url.Values{"app_id": {"sleep"}, "urls": {"http://example.com"}})
	var postResult struct{ IDs []int64 }
	json.NewDecoder(resp.Body).Decode(&postResult)
	jobID := postResult.IDs[0]

	// Give it a moment to start
	time.Sleep(500 * time.Millisecond)

	// Cancel job
	cancelResp, err := http.Post(ts.URL+fmt.Sprintf("/api/jobs/%d/cancel", jobID), "", nil)
	if err != nil || cancelResp.StatusCode != http.StatusNoContent {
		t.Fatalf("failed to cancel: %v", err)
	}

	// Verify status
	time.Sleep(500 * time.Millisecond)
	j, _ := store.GetJob(db, jobID)
	if j.Status != store.StatusCancelled {
		t.Fatalf("expected status cancelled, got %s", j.Status)
	}
}

func TestIntegration_RetryAndCleanup(t *testing.T) {
	tmpDir, _ := os.MkdirTemp("", "lowtide-retry-*")
	defer os.RemoveAll(tmpDir)

	dbPath := filepath.Join(tmpDir, "test.db")
	downloadsDir := filepath.Join(tmpDir, "downloads")
	os.MkdirAll(downloadsDir, 0755)

	db, _ := sql.Open("sqlite3", dbPath+"?_fk=1")
	defer db.Close()
	store.Init(db)

	cfg := &config.Config{
		DBPath:       dbPath,
		DownloadsDir: downloadsDir,
		Apps:         []config.AppConfig{{ID: "fail-then-succeed", Command: "sh", Args: []string{"-c", "if [ -f fail_flag ]; then rm fail_flag; exit 1; else echo success > success.txt; fi"}}},
	}

	// In the new system, jobs run in their own folder.
	// For the initial run (job 1), we need to create the fail_flag in its folder.
	job1Dir := filepath.Join(downloadsDir, "1")
	os.MkdirAll(job1Dir, 0755)
	os.WriteFile(filepath.Join(job1Dir, "fail_flag"), []byte("fail"), 0644)

	mgr, _ := jobs.NewManager(db, cfg)
	srv := NewServer(db, cfg, mgr)
	ts := httptest.NewServer(srv.Routes())
	defer ts.Close()

	// 1. Run and Fail
	http.PostForm(ts.URL+"/api/jobs", url.Values{"app_id": {"fail-then-succeed"}, "urls": {"http://example.com"}})
	time.Sleep(1 * time.Second) // wait for failure

	j, _ := store.GetJob(db, 1)
	if j.Status != store.StatusFailed {
		t.Fatalf("expected failure, got %s", j.Status)
	}

	// 2. Retry
	http.Post(ts.URL+"/api/jobs/1/retry", "", nil)
	time.Sleep(1 * time.Second) // wait for success

	j, _ = store.GetJob(db, 1)
	if j.Status != store.StatusSuccess {
		t.Fatalf("expected success on retry, got %s", j.Status)
	}

	// 3. Cleanup
	cleanupResp, err := http.Post(ts.URL+"/api/jobs/1/cleanup", "", nil)
	if err != nil || cleanupResp.StatusCode != http.StatusNoContent {
		t.Fatal("cleanup failed")
	}

	if _, err := os.Stat(filepath.Join(job1Dir, "success.txt")); !os.IsNotExist(err) {
		t.Fatal("file should have been deleted by cleanup")
	}
	if _, err := os.Stat(job1Dir); !os.IsNotExist(err) {
		t.Fatal("job directory should have been deleted by cleanup")
	}

	j, _ = store.GetJob(db, 1)
	if j.Status != store.StatusCleaned {
		t.Fatalf("expected status cleaned, got %s", j.Status)
	}
}

func TestIntegration_PathSafetyAndWeirdURLs(t *testing.T) {
	tmpDir, _ := os.MkdirTemp("", "lowtide-safety-*")
	defer os.RemoveAll(tmpDir)

	dbPath := filepath.Join(tmpDir, "test.db")
	downloadsDir := filepath.Join(tmpDir, "downloads")
	os.MkdirAll(downloadsDir, 0755)

	db, _ := sql.Open("sqlite3", dbPath+"?_fk=1")
	defer db.Close()
	store.Init(db)

	cfg := &config.Config{DBPath: dbPath, DownloadsDir: downloadsDir}
	mgr, _ := jobs.NewManager(db, cfg)
	srv := NewServer(db, cfg, mgr)
	ts := httptest.NewServer(srv.Routes())
	defer ts.Close()

	// 1. Weird URLs
	weirdURLs := `  http://example.com/ space  
  https://google.com  
  invalid-url  `
	resp, _ := http.PostForm(ts.URL+"/api/jobs", url.Values{"app_id": {"auto"}, "urls": {weirdURLs}})
	if resp.StatusCode == http.StatusOK {
		var postResult struct{ IDs []int64 }
		json.NewDecoder(resp.Body).Decode(&postResult)
	}

	// 2. Path Safety
	// Inject a job file with a malicious path manually into DB
	store.InsertJob(db, "test", "http://test.com", time.Now())
	secretPath := filepath.Join(tmpDir, "secret.txt")
	os.WriteFile(secretPath, []byte("sensitive"), 0644)

	// Try to use a path with ..
	badPath := filepath.Join(downloadsDir, "1", "../../secret.txt")
	store.InsertJobFile(db, 1, badPath, 9, time.Now())

	// Try to download via API
	files, _ := store.ListJobFiles(db, 1)
	fid := files[0].ID

	dlResp, _ := http.Get(ts.URL + fmt.Sprintf("/api/jobs/1/files/%d", fid))
	if dlResp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400 for out-of-bounds path, got %d", dlResp.StatusCode)
	}
}

func TestIntegration_JobImages(t *testing.T) {
	// Setup temporary workspace
	tmpDir, err := os.MkdirTemp("", "lowtide-imagetest-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tmpDir)

	dbPath := filepath.Join(tmpDir, "test.db")
	downloadsDir := filepath.Join(tmpDir, "downloads")
	err = os.MkdirAll(downloadsDir, 0755)
	if err != nil {
		t.Fatal(err)
	}

	// Create a test image (simple PNG)
	testImageData := []byte{
		0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG header
		0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk start
		0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 pixel
		0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, // image specs
		0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, // IDAT chunk
		0x54, 0x08, 0x99, 0x01, 0x01, 0x01, 0x00, 0x00,
		0xFE, 0xFF, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01,
		0xE2, 0x21, 0xBC, 0x33, 0x00, 0x00, 0x00, 0x00, // IEND chunk
		0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
	}

	// Setup mock server that serves HTML with OpenGraph tags
	var mockServerURL string
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/test-page":
			// Serve HTML page with OpenGraph tags
			html := `<!DOCTYPE html>
<html>
<head>
    <meta property="og:title" content="Test Page Title" />
    <meta property="og:image" content="` + mockServerURL + `/test-image.png" />
</head>
<body><h1>Test Page</h1></body>
</html>`
			w.Header().Set("Content-Type", "text/html")
			w.Write([]byte(html))
		case "/test-image.png":
			// Serve test image
			w.Header().Set("Content-Type", "image/png")
			w.Write(testImageData)
		case "/no-image-page":
			// Page without og:image
			html := `<!DOCTYPE html>
<html>
<head>
    <meta property="og:title" content="No Image Page" />
</head>
<body><h1>No Image</h1></body>
</html>`
			w.Header().Set("Content-Type", "text/html")
			w.Write([]byte(html))
		default:
			http.NotFound(w, r)
		}
	}))
	defer mockServer.Close()
	mockServerURL = mockServer.URL

	// Setup Low Tide Server
	db, err := sql.Open("sqlite3", dbPath+"?_fk=1")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	if err := store.Init(db); err != nil {
		t.Fatal(err)
	}

	cfg := &config.Config{
		DownloadsDir: downloadsDir,
		Apps: []config.AppConfig{
			{ID: "test", Name: "Test App", Command: "echo 'test'"},
		},
	}

	mgr, err := jobs.NewManager(db, cfg)
	if err != nil {
		t.Fatal(err)
	}

	server := NewServer(db, cfg, mgr)
	ts := httptest.NewServer(server.Routes())
	defer ts.Close()

	t.Run("Job with OpenGraph image", func(t *testing.T) {
		// Create job with page that has og:image
		testURL := mockServer.URL + "/test-page"
		resp, err := http.PostForm(ts.URL+"/api/jobs", url.Values{
			"app_id": {"test"},
			"urls":   {testURL},
		})
		if err != nil {
			t.Fatal(err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			t.Fatalf("expected 200, got %d", resp.StatusCode)
		}

		var result struct {
			IDs []int64 `json:"ids"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
			t.Fatal(err)
		}

		if len(result.IDs) != 1 {
			t.Fatalf("expected 1 job, got %d", len(result.IDs))
		}

		jobID := result.IDs[0]

		// Wait for metadata processing
		time.Sleep(2 * time.Second)

		// Check job has image_path set
		job, err := store.GetJob(db, jobID)
		if err != nil {
			t.Fatal(err)
		}

		if job.ImagePath == nil {
			t.Fatal("expected job to have image_path set")
		}

		// Check image file exists
		thumbnailsDir := filepath.Join(downloadsDir, "thumbnails")
		expectedImagePath := filepath.Join(thumbnailsDir, fmt.Sprintf("%d.png", jobID))
		if _, err := os.Stat(expectedImagePath); os.IsNotExist(err) {
			t.Fatal("expected image file to exist")
		}

		// Test thumbnail endpoint - now uses job ID instead of filename
		thumbResp, err := http.Get(fmt.Sprintf("%s/thumbnails/%d", ts.URL, jobID))
		if err != nil {
			t.Fatal(err)
		}
		defer thumbResp.Body.Close()

		if thumbResp.StatusCode != http.StatusOK {
			t.Fatalf("expected 200 for thumbnail, got %d", thumbResp.StatusCode)
		}

		if thumbResp.Header.Get("Content-Type") != "image/png" {
			t.Fatalf("expected image/png content type, got %s", thumbResp.Header.Get("Content-Type"))
		}
	})

	t.Run("Job without OpenGraph image", func(t *testing.T) {
		// Create job with page that has no og:image
		testURL := mockServer.URL + "/no-image-page"
		resp, err := http.PostForm(ts.URL+"/api/jobs", url.Values{
			"app_id": {"test"},
			"urls":   {testURL},
		})
		if err != nil {
			t.Fatal(err)
		}
		defer resp.Body.Close()

		var result struct {
			IDs []int64 `json:"ids"`
		}
		json.NewDecoder(resp.Body).Decode(&result)
		jobID := result.IDs[0]

		// Wait for metadata processing
		time.Sleep(2 * time.Second)

		// Check job has no image_path
		job, err := store.GetJob(db, jobID)
		if err != nil {
			t.Fatal(err)
		}

		if job.ImagePath != nil {
			t.Fatal("expected job to have no image_path")
		}
	})

	t.Run("Thumbnail security", func(t *testing.T) {
		// Test various security scenarios with the job ID based endpoint
		
		// Test 1: Invalid job ID format
		resp, err := http.Get(ts.URL + "/thumbnails/invalid")
		if err != nil {
			t.Fatal(err)
		}
		defer resp.Body.Close()
		
		if resp.StatusCode != http.StatusBadRequest {
			t.Fatalf("expected 400 for invalid job ID, got %d", resp.StatusCode)
		}

		// Test 2: Non-existent job ID
		resp2, err := http.Get(ts.URL + "/thumbnails/99999")
		if err != nil {
			t.Fatal(err)
		}
		defer resp2.Body.Close()
		
		if resp2.StatusCode != http.StatusNotFound {
			t.Fatalf("expected 404 for non-existent job, got %d", resp2.StatusCode)
		}

		// Test 3: Job without image
		// Create a job without an image first (we already have one from the previous test)
		// The "no-image-page" job should be job ID 2
		resp3, err := http.Get(ts.URL + "/thumbnails/2")
		if err != nil {
			t.Fatal(err)
		}
		defer resp3.Body.Close()
		
		if resp3.StatusCode != http.StatusNotFound {
			t.Fatalf("expected 404 for job without image, got %d", resp3.StatusCode)
		}
	})
}
