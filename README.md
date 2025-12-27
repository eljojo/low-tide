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
- **Theme Support**: Includes multiple built-in themes ('The Archivist', 'Midnight Vinyl', 'The Broadcaster') to match your aesthetic.

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

## Contributing

For details on architecture, data flow, and how to develop for Low Tide, please see [CONTRIBUTING.md](CONTRIBUTING.md).

---

## License

AGPL-3.0-only
