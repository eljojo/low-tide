# Docker Usage Guide

This guide covers how to use Low Tide with Docker, including customization and advanced usage patterns.

## Quick Start

### Using Docker Compose (Recommended)

1. Create a `docker-compose.yml` file (or use the provided example):

```yaml
version: '3.8'

services:
  low-tide:
    image: ghcr.io/eljojo/low-tide:latest
    container_name: low-tide
    ports:
      - "8080:8080"
    volumes:
      - low-tide-data:/data
      # Optional: mount custom config file
      # - ./custom-config.yaml:/app/config/config.yaml:ro
    restart: unless-stopped

volumes:
  low-tide-data:
    driver: local
```

2. Start the service:

```bash
docker compose up -d
```

3. Access Low Tide at <http://localhost:8080>

### Using Docker CLI
This will store data in a host directory `/var/lib/low-tide` instead of docker volumes:

```bash
docker run -d \
  --name low-tide \
  -p 8080:8080 \
  -v /var/lib/low-tide:/data \
  -e LOWTIDE_DOWNLOADS_DIR=/data \
  -e LOWTIDE_DB_PATH=/data/lowtide.db \
  ghcr.io/eljojo/low-tide:latest
```

---

## Configuration

### Environment Variables

The following environment variables can be used to configure Low Tide:

- `LOWTIDE_CONFIG` - Path to the config YAML file (default: `/app/config/config.yaml`)
- `LOWTIDE_DOWNLOADS_DIR` - Directory for downloaded files (default: `/data`)
- `LOWTIDE_DB_PATH` - Path to the SQLite database file (default: `/data/lowtide.db`)

---

## Customizing the Docker Image

### Creating a Custom Image

You can create your own Docker image that extends the Low Tide base image to add additional packages or configurations.

#### Example 1: Adding Extra Download Tools

Create a `Dockerfile`:

```dockerfile
FROM ghcr.io/eljojo/low-tide:latest

# Install additional packages
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        wget \
        aria2 \
        curl \
        && rm -rf /var/lib/apt/lists/*

# Install Custom Python dependencies
RUN pip3 install --no-cache-dir \
    pycryptodome \
    websockets

# Optionally copy a custom config
COPY my-config.yaml /app/config/config.yaml
```

Build and run as usual 🌊
