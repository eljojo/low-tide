Low Tide
=========

Low Tide is a self-hosted, single-node web app for managing media downloads (using tools like `yt-dlp`, `tidal-dl`, etc.) with a live UI and simple automation.

It is designed to be **simple, predictable, and visual**.

### Why Low Tide?
*   **Visual & Live:** Watch the download process in real-time. The UI shows you the console output as it happens and updates the file list instantly as files are written to disk.
*   **One Job at a Time:** It deliberately runs a single worker to process jobs sequentially. This avoids API throttling from services (like YouTube or Tidal) and keeps resource usage low.
*   **Pluggable Backends:** It shells out to any command-line tool you configure. It doesn't implement download logic itself; it just orchestrates the CLI tools you already use.
*   **Self-Contained:** A single binary with an embedded SQLite database. No Redis, no external DB, no complex setup.
*   **State Recovery:** Everything is persisted. If the server crashes, your job history, logs, and downloaded artifacts are safe.

---

## Developer Guide & Architecture

Low Tide behaves like a "Meteor" app or a synchronized state machine. The backend is the source of truth, and the frontend is a thin view that reflects the current state.

### Core Philosophy: "Snapshot as Truth"
Instead of sending many small, imperative events (e.g., "job started", "file added", "status changed"), the server frequently broadcasts a **complete snapshot** of the job state.

*   **Synchronization:** When a job changes (status update, new file found), the server sends the full serialized JSON of the Job object and its related Files.
*   **Simplicity:** The frontend doesn't need complex state management (reducers, patch logic). It simply replaces its local object with the new snapshot.
*   **Resilience:** If a WebSocket message is dropped, the next snapshot will correct the state. There is no "drift."

### Project Structure

#### `jobs/manager.go` (The Brain)
*   **Lifecycle:** Manages the background worker, queues jobs, and executes the shell commands.
*   **FS Watcher:** Uses `fsnotify` to watch the download directory. When files are created or deleted, it updates the database immediately.
*   **Broadcasting:** Handles the WebSocket hub. When the DB updates, it broadcasts `JobSnapshotEvent` to all connected clients.
*   **Logging:** Captures `stdout`/`stderr` from the subprocess, saves them to SQLite, and streams them live to the frontend.

#### `store/` (The Persistence)
*   **SQLite:** All state is stored in `sqlite3`.
*   **Schema:**
    *   `jobs`: Metadata (status, URL, timestamps).
    *   `job_files`: Artifacts produced by jobs (path, size).
    *   `job_logs`: Persisted console output.
*   **Logic:** The store package handles all DB interactions. It treats file paths as unique constraints to prevent duplicate records.

#### `main.go` (The API)
*   **HTTP Server:** Exposes the REST API and serves the embedded UI.
*   **WebSocket:** `/ws/state` is the main firehose for UI updates.
*   **Artifacts:** Handles ZIP generation on the fly for downloading job results.

#### `templates/index.html` (The View)
*   **Single File:** The entire frontend is a single HTML file with embedded CSS/JS.
*   **Reactive:** Connects to `/ws/state`. deeply coupled to the server's event model.
*   **UX:** Auto-expands the console for running/failed jobs, auto-expands the file list for successful jobs.

### Contributing
*   **Design Decision:** We prefer sending slightly more data (full snapshots) over complex client-side logic.
*   **Design Decision:** File system events are the source of truth for artifacts. If `yt-dlp` creates a file, `fsnotify` sees it -> DB updates -> UI updates. We don't parse `yt-dlp` logs to find files.

### Quickstart (Dev)
```bash
# Run with default config
LOWTIDE_CONFIG=config/config.yaml go run .
```
