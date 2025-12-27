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
## Frontend Development

We follow a specific philosophy for frontend styling:

1.  **Mini Framework**: We have a set of internal base classes (prefixed with `.lt-`) defined in `frontend/css/main.css`. Components should use these classes.
2.  **Theming**: Themes (in `frontend/css/themes/`) customize the look by overriding CSS variables and targeting the `.lt-` classes.
3.  **Components**: We use `goober` for component-level styles. Reusable patterns should be extracted.

See `frontend/.goosehints` for the full style guide.

4. Subprocess output is captured:
   - persisted into SQLite
   - streamed live to the browser
5. The filesystem watcher observes artifacts written under `watch_dir` and records them in SQLite.
6. Connected browsers receive WebSocket updates and re-render.

## Repository layout

- `main.go`
  - HTTP server, API routing, serving embedded UI assets
  - WebSocket endpoint for live updates
  - ZIP streaming + single artifact downloads
- `jobs/manager.go`
  - Single-worker queue
  - Subprocess execution
  - Live log streaming
  - Filesystem watch loop and artifact reconciliation
  - Pub/sub for broadcasting state
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

- **Artifact paths are always validated** before download/delete to prevent escaping `watch_dir`.
- **Artifact discovery is FS-driven** (watcher events + reconciliation), not log-parsing.
- **Terminal rendering** uses ANSI-to-HTML conversion and supports **delta updates** to reduce DOM churn.

---

## Ideas / future work

Feature ideas that fit the project’s “small and predictable” scope:

- Authentication (simple password / OAuth via reverse proxy headers/JWT)
- Safer URL validation and stricter command argument handling
- Per-app environment variables / working directory configuration
- Better artifact naming for ZIP downloads (derive from job title/app)
- Optional concurrency limits (still bounded) for advanced users
- Dockerfile / container-friendly defaults
