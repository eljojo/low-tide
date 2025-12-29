# Developer Guide (Architecture & Design)

This guide is for contributors who want to understand Low Tide's internal workings.

---

## Core Architecture

Low Tide operates as a **synchronized state machine** where the backend is the source of truth and the frontend is a thin view.

### Data Flow & Execution
1. **Job Creation**: User submits a URL via HTTP API. `jobs.Manager` queues the job.
2. **Execution**: A single background worker runs the configured CLI tool in a dedicated subfolder (e.g., `downloads/123/`).
3. **Observation**: 
   - **Logs**: Subprocess output is captured, persisted to SQLite, and streamed via WebSockets as ANSI-to-HTML deltas.
   - **Artifacts**: A filesystem watcher detects new files in the job directory.
4. **State Broadcast**: The server frequently broadcasts **complete job snapshots**. This "snapshot as truth" approach ensures the UI self-heals if messages are dropped.

### Storage & Persistence
- **SQLite**: Stores job metadata (URLs, status, errors), terminal logs (HTML), and discovered artifact paths.
- **FS-Driven Discovery**: Artifact attribution relies on filesystem events and resyncs, not log parsing.
- **Job Lifecycle**:
  - **Archive**: Hides jobs from the default UI without deleting files.
  - **Cleanup**: Deletes the job's directory and marks it as `cleaned`.
  - **Retry**: Resets state, clears logs, and wipes recorded artifacts for a fresh run.

---

## Technical Details

- **Security**: Strict URL validation prevents SSRF by blocking private/LAN IPs (bypass with `LOWTIDE_STRICT_URL_VALIDATION=false`).
- **Web Interface**: A single WebSocket "state channel" handles snapshots, log streaming, and state invalidations.
- **Frontend Styling**: 
  - Uses a mini-framework of `.lt-` base classes in `frontend/css/main.css`.
  - Themes override CSS variables to target these classes.
  - Component-specific styles use `goober`.

---

## Testing

- **Backend**: Use `make test` for integration tests.
- **Frontend/E2E**: Use `make test-e2e` to run Playwright tests against a built version of the app.
- **There's more useful commands in the Makefile!**

---

## Roadmap & Future Ideas

- Authentication (OAuth/Header-based via reverse proxy).
- Per-app environment variables and custom working directories.
- Optional bounded concurrency.
- Webhooks/callbacks on job completion.
- Temporary download directories with post-completion migration.

---

## .goosehints
This project is developed using [Goose](https://block.github.io/goose/). `.goosehints` files contain context relevant to AI-agents, but could also be interesting for humans to read.
