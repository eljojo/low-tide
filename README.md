Low Tide
=========

Low Tide is a small, single-node Go web app that runs downloader jobs (shelling out to apps like yt-dlp), persists artifacts and logs, and provides a minimal live-updating web UI and simple JSON/WebSocket APIs for automation and inspection.

Core features
- Queue and run single-URL download jobs with a single worker (predictable, simple model).
- Persist job metadata, artifact records (files & dirs), and job logs to a local SQLite database.
- Live UI that auto-updates via a state WebSocket and lets operators download artifacts, view logs, and perform job actions (retry, archive, delete).
- Simple HTTP API for creating jobs, listing jobs, downloading artifacts, and cleaning up.

Quickstart
1. Run (default config path: `config/config.yaml`):

```bash
LOWTIDE_CONFIG=config/config.yaml ./low-tide
```

2. Open the UI in a browser (default: `http://localhost:8080`).

Notes for users
- Single-URL-per-job: each job represents a single URL. If you submit multiple URLs in the UI, the server will create one job per URL.
- Real-time UI updates: the UI connects to a WebSocket to receive live job state and log updates.
- Artifacts and logs are persisted locally so job history survives restarts.

Developer notes — internal architecture & scratch pad
----------------------------------------------------

(Keep reading only if you're working on development or debugging.)

High-level architecture
- Manager (jobs.Manager): watches a configured filesystem directory, queues jobs, runs a single worker that executes a configured downloader command, records produced files/dirs, and persists logs.
- Store (store package): SQLite-backed persistence for jobs, files, directories, and logs.
- HTTP server (main.go): exposes REST endpoints and two websockets:
  - /ws/state — broadcasts typed JSON state events (job snapshots, partial file updates, job-log events, archive notifications).
  - /ws/logs  — a per-job plain-text log socket (backwards-compatible stream of text lines). # TODO: Remove this in favor of /ws/state job_log events.

Event model (state websocket)
- job_snapshot: full canonical snapshot of a job (includes job metadata, files, timestamp). Treat this as the authoritative representation of the job; clients may replace their in-memory job object with the snapshot. # TODO remove dirs? not necessary key
- files_update_partial: incremental file/dir metadata for quick UI updates while downloads are in progress.
- files_update: (used in some create/finalize flows) a full files/dirs list for the job. # TODO: remove this in favor of job_snapshot
- job_log: single-line log events broadcast on the state websocket in addition to the legacy /ws/logs stream.
- job_update / jobs_archived: still used for some status broadcasts (queued/archived), but start/finish and delete now use job_snapshot as the authoritative broadcast. # TODO: remove job_update and jobs_archived in favor of job_snapshot

Recent behavior changes
- Start/finish broadcasts: when a job transitions to running or to finished/failed, the manager now broadcasts a job_snapshot so clients always receive full job JSON at those transitions.
- Deletes: when recorded files or recorded dirs are removed, the manager now broadcasts a job_snapshot (instead of files_update) so clients see the canonical job state after a deletion.
- Logs: live console lines are still written to the per-job log subscribers (the /ws/logs socket). In addition, each log line is emitted as a job_log event on the /ws/state socket so clients that only use the state socket receive logs too. # TODO: this needs to be refactored so it's only one websocket, events emited to /ws/state include the job id so the client should know where to store it in its local db.

Why snapshots?
- Simplicity: sending the full canonical job JSON lets clients replace their entire job representation, avoiding subtle state-sync bugs caused by many small incremental events.
- Consistency: deletes and status changes are easier to reason about when clients receive the single source-of-truth snapshot.

Key files and responsibilities
- jobs/manager.go — job lifecycle, filesystem watcher, snapshot scheduling, state/log broadcasts.
- main.go — HTTP handlers, websocket upgrade handlers (`/ws/state` and `/ws/logs`), API endpoints for job actions and artifact downloads.
- store/* — DB schema and helpers (job, job_files, job_dirs, job_logs).

---
