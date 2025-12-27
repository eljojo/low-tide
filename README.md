# Low Tide

Low Tide is a **self-hosted, single-node web app** for managing media downloads (via tools like `yt-dlp`, `tidal-dl-ng`, etc.) with a **live UI**, **persisted history**, and **simple automation**.

It’s built for homelabs where you want:

- A small, predictable service you can run on a box/NAS/VPS
- A UI you can leave open while downloads run
- A clean separation between “orchestration” and “download logic”

---

## What makes it different

- **Pluggable download backends (CLI-first)**: Low Tide doesn’t re-implement YouTube/Tidal/etc. It runs the CLI tools you already trust, based on a YAML config.
- **Live terminal in the browser**: See the subprocess output as it happens (ANSI formatting preserved), not just “percent complete”.
- **Artifact tracking without guesswork**: Files are detected via **filesystem watching**, so the UI updates as soon as files land on disk.
- **State survives restarts**: Jobs, output logs, and discovered artifacts are persisted to a local **SQLite** database.
- **Deliberately sequential**: One worker processes jobs **one-at-a-time** to reduce throttling/rate limits and keep resource usage sane.

---

## What you can do with it

- Queue URLs (one URL per job; paste multiple URLs to create multiple jobs)
- Choose a downloader “app” (or let Low Tide auto-pick based on URL regex)
- Watch logs live while the job runs, in real time (websockets babayy!!!)
- Download results (single file or a ZIP of all job artifacts)
- Cancel running jobs
- Retry failed/cancelled jobs
- Archive finished jobs, so they don't show up in the UI
- “Cleanup” a job (delete artifacts on disk and mark the job cleaned)

---

## Configuration (high level)

Low Tide is configured via a YAML file, take a look at `config/example.yaml` for a full example.

```yaml
listen_addr: ":8080"
db_path: "/var/lib/lowtide/lowtide.db"
watch_dir: "/var/lib/lowtide/downloads"
apps:
  - id: "yt-dlp"
    name: "yt-dlp"
    command: "yt-dlp"
    args: ["-P", ".", "%u"]
    regex: '^https?://(www\.)?(youtube|vimeo|soundcloud|bandcamp|mixcloud)\.com/'
  - id: "tidal-dl-ng"
    name: "tidal-dl-ng"
    command: "tidal-dl-ng"
    strip_trailing_slash: true
    args: ["dl", "%u"]
    regex: '^https?://(www\.|listen\.)?tidal\.com/'
```

---

## Status, scope, and non-goals

Low Tide is intentionally small and opinionated.

- **Single-node**: no clustering, no distributed workers.
- **Not a multi-user service**: there is currently **no authentication/authorization**.
- **Not a generic workflow engine**: the core job model is “run a command for a URL, then track produced files”.

If you want multi-user permissions, remote storage backends, and a full download-manager ecosystem, you may prefer other tools.

---

## Security notes (important)

This repo is best treated as **LAN-only / behind a reverse proxy with auth** today.

- The WebSocket upgrader currently accepts all origins (`CheckOrigin: true`).
- The server executes configured commands; treat config changes as privileged.
- URL parsing/sanitization is intentionally minimal today (see TODOs in code).

---

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

---

## License

AGPL-3.0-only
