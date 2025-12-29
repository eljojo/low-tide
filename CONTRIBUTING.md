# Developer guide (architecture & decisions)

This section is for contributors who want to understand how the system works.

## Mental model

Low Tide behaves like a **synchronized state machine**:

- The backend is the source of truth.
- The frontend is a thin view that mostly renders server state.

### Design decision: “Snapshot as truth”

Instead of having the frontend reconstruct state from many small imperative events, the server frequently broadcasts **complete job snapshots**.

Benefits:

- The UI can be simple (replace local job state with the new snapshot)
- If a message is dropped, the next snapshot self-heals state
- State recovery after restarts is straightforward (SQLite is the durable truth)

## High-level data flow

1. User creates a job via the HTTP API.
2. The `jobs.Manager` queues the job ID.
3. A single background worker executes the configured CLI command for that job.
4. Subprocess output is captured:
   - persisted into SQLite
   - streamed live to the browser
5. The filesystem watcher observes artifacts written under `downloads_dir` and records them in SQLite.
6. Connected browsers receive WebSocket updates and re-render.

## Data & storage behavior

Low Tide persists both **job metadata** and **job output** so the UI can recover cleanly after restarts.

### What’s stored in SQLite

The SQLite DB (`db_path`) currently stores:

- **jobs**
  - URL, selected app ID, status, timestamps, exit code/error, archive flag
  - **logs** (rendered terminal HTML)
- **job_files**
  - absolute file path, size, timestamps

### How artifacts are detected / attributed

- Artifact discovery is **filesystem-driven**, not log parsing.
- Each job executes within its own subdirectory under `downloads_dir`, named by its job ID (e.g., `downloads/123/`).
- While a job is running, any newly created/updated files within that job's directory are recorded in `job_files`.
- On both job start and job finish, Low Tide performs a filesystem resync of the job's directory to ensure all artifacts are accounted for.

### Archive vs cleanup vs retry

- **Archive**: marks the job as archived so it won’t show up in the default UI view. Artifacts are not deleted.
- **Cleanup**: deletes the entire job directory from disk and marks the job as `cleaned` (and archived).
- **Retry**: resets job status back to `queued`, clears terminal output and error state, and clears recorded `job_files` for that job.

## Frontend Development

We follow a specific philosophy for frontend styling:

1. **Mini Framework**: We have a set of internal base classes (prefixed with `.lt-`) defined in `frontend/css/main.css`. Components should use these classes.
2. **Theming**: Themes (in `frontend/css/themes/`) customize the look by overriding CSS variables and targeting the `.lt-` classes.
3. **Components**: We use `goober` for component-level styles. Reusable patterns should be extracted.

See `frontend/.goosehints` for the full style guide.

## Repository layout

- `main.go`
  - HTTP server, API routing, serving embedded UI assets
  - WebSocket endpoint for live updates
  - ZIP streaming + single artifact downloads
- `jobs/`
  - `manager.go`: manager wiring, startup, recovery, and the single-worker queue loop
  - `job_execution.go`: subprocess execution (PTY), cancellation, and filesystem resync
  - `file_watcher.go`: fsnotify watch loop + artifact attribution to the currently running job
  - `state_broadcast.go`: WebSocket pub/sub + job snapshot broadcasting + log delta events
  - `change_tracker.go`: dirty tracking + throttled snapshot publishing
  - `metadata.go`: fetch/parse `og:title`/`<title>` and persist job titles
- `store/`
  - SQLite schema + queries (jobs, files, logs)
- `config/`
  - YAML config model + app matching (`regex`) and URL normalization
- `frontend/`
  - Source UI (Preact + Zustand)
  - Bundled output is committed under `/static` (do not edit `/static` directly)
- `internal/terminal/`
  - Server-side virtual terminal rendering logic (ANSI to HTML, delta updates)

## Web/API surface (summary)

- HTTP
  - List/create jobs
  - Job actions: retry/cancel/archive/cleanup
  - Download artifacts (single file) or ZIP
- WebSocket
  - A single “state channel” used by the UI for:
    - job snapshot updates
    - log streaming
    - coarse state invalidations (e.g. jobs archived)

(Exact message shapes/types are intentionally documented in code near their definitions.)

## Notable implementation details

- **Artifact paths are always validated** before download/delete to prevent escaping `downloads_dir`.
- **Strict URL Validation**: Before creating a job, the server resolves the URL hostname and ensures it doesn't point to a private/LAN IP range. This is enabled by default for security. It can be bypassed for local development by setting `LOWTIDE_STRICT_URL_VALIDATION=false` in the environment.
- **Artifact discovery is FS-driven** (watcher events + reconciliation), not log-parsing.
- **Terminal rendering** uses ANSI-to-HTML conversion and supports **delta updates** to reduce DOM churn.

---

## Ideas / future work

Feature ideas that fit the project’s “small and predictable” scope:

- Authentication (simple password / OAuth via reverse proxy headers/JWT)
- Per-app environment variables / working directory configuration
- Optional concurrency limits (still bounded) for advanced users
- Dockerfile / container-friendly defaults
- Temporary download directories per job (watch temp dir, move files to `artifacts_dir` on completion)
- Customizable download locations per app
- Callbacks / webhooks on job completion/failure
