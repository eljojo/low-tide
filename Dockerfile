# syntax=docker/dockerfile:1

# ============================================================================
# Stage 1: Build the Go application and frontend assets
# ============================================================================
FROM ubuntu:24.04 AS builder

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        golang-go \
        nodejs \
        npm \
        && rm -rf /var/lib/apt/lists/*

WORKDIR /build

COPY go.mod go.sum ./
RUN go mod download

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN make build-frontend

RUN CGO_ENABLED=1 go build -o low-tide -ldflags="-s -w" .

# ============================================================================
# Stage 2: Runtime image
# ============================================================================
FROM ubuntu:24.04

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        ffmpeg \
        axel \
        python3 \
        python3-pip \
        && rm -rf /var/lib/apt/lists/*

RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

COPY --from=builder /build/low-tide /app/low-tide
COPY --from=builder /build/config/config.yaml /app/config/config.yaml

RUN mkdir -p /data

ENV LOWTIDE_CONFIG=/app/config/config.yaml \
    LOWTIDE_DOWNLOADS_DIR=/data \
    LOWTIDE_DB_PATH=/data/lowtide.db

EXPOSE 8080

CMD ["/app/low-tide"]
