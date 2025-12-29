# Low Tide

Low Tide is a **self-hosted, single-node web app** for managing media downloads (via tools like `yt-dlp`, `axel`, etc.) with a **live UI**, **persisted history**, and **simple automation**.

Built for homelabs, it provides a clean separation between orchestration and download logic, allowing you to leave a UI open while downloads run on a small, predictable service.

---

## Features

- **Pluggable Backends**: Runs the CLI tools you already trust (`yt-dlp`, `axel`, etc.) based on YAML config.
- **Live Terminal**: See real-time subprocess output with ANSI formatting in your browser.
- **Artifact Tracking**: Automatic filesystem watching detects results as soon as they land on disk.
- **Queue Management**: Queue URLs (single or bulk), cancel running jobs, and retry failures.
- **State Persistence**: Jobs, logs, and artifacts are persisted to a local **SQLite** database.
- **One-at-a-Time Worker**: Processes jobs sequentially to reduce rate limits and keep resource usage predictable.
- **Management Tools**: Download results (single file or ZIP), archive finished jobs, and safe artifact cleanup.
- **Theme Support**: Multiple built-in themes like 'The Archivist', 'Midnight Vinyl', and 'The Broadcaster'.

---

## Configuration

Low Tide is configured via a YAML file. See [`config/config.yaml`](config/config.yaml) for a complete example.

```yaml
listen_addr: ":8080"
db_path: "/var/lib/lowtide/lowtide.db"
downloads_dir: "/var/lib/lowtide/downloads"
apps:
  - id: "video"
    name: "Video (best)"
    command: "yt-dlp"
    args: ["-f", "bestvideo+bestaudio", "-P", ".", "%u"]
    regex: '^https?://(www\.)?(youtube|vimeo)\.com/'
  - id: "audio"
    name: "Audio (best)"
    command: "yt-dlp"
    args: ["-f", "bestaudio", "-x", "--audio-format", "mp3", "-P", ".", "%u"]
    regex: '^https?://(www\.)?(soundcloud|bandcamp|mixcloud)\.com/'
```

---

## Philosophy & Constraints

Low Tide is intentionally small and opinionated.

- **Single-node / Single-user**: No clustering, distributed workers, or built-in authentication. Use a reverse proxy for auth.
- **Sequential Execution**: Jobs are processed one-at-a-time by design.
- **Isolated Artifacts**: Each job runs in a dedicated subfolder within `downloads_dir` for safe tracking and cleanup.
- **Strict URL Validation**: Rejects local/private IP ranges by default (SSRF protection). Disable via `LOWTIDE_STRICT_URL_VALIDATION=false`.
- **Config is Privileged**: The server executes configured commands; treat configuration changes as privileged.

---

## Contributing & Docs

- **Configuration Details**: [`config/config.yaml`](config/config.yaml)
- **Development & Architecture**: [CONTRIBUTING.md](CONTRIBUTING.md)

---

## License

AGPL-3.0-only
