package main

import (
	"archive/zip"
	"fmt"
	"io"
	"log"
	"mime"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// helper to create a safe Content-Disposition header with both filename and filename*
func contentDisposition(filename string) string {
	base := filepath.Base(filename)
	// sanitize simple problematic characters
	safe := strings.Map(func(r rune) rune {
		if r == '\\' || r == '"' || r == '\n' || r == '\r' || r == '/' || r == '\x00' {
			return '_'
		}
		return r
	}, base)
	escaped := url.PathEscape(base)
	return fmt.Sprintf("attachment; filename=\"%s\"; filename*=UTF-8''%s", safe, escaped)
}

func setDownloadHeaders(w http.ResponseWriter, filename string) {
	w.Header().Set("Content-Disposition", contentDisposition(filename))
	if ext := filepath.Ext(filename); ext != "" {
		if mt := mime.TypeByExtension(ext); mt != "" {
			w.Header().Set("Content-Type", mt)
		}
	}
}

// loggingMiddleware logs basic request information for every HTTP request.
func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		log.Printf("%s %s from %s", r.Method, r.URL.Path, r.RemoteAddr)
		next.ServeHTTP(w, r)
		log.Printf("%s %s done in %s", r.Method, r.URL.Path, time.Since(start))
	})
}

func splitURLs(s string) []string {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	lines := strings.Split(s, "\n")
	var out []string
	for _, line := range lines {
		fields := strings.Fields(line)
		out = append(out, fields...)
	}
	uniq := make([]string, 0, len(out))
	seen := map[string]struct{}{}
	for _, u := range out {
		if u == "" {
			continue
		}
		if _, ok := seen[u]; ok {
			continue
		}
		seen[u] = struct{}{}
		uniq = append(uniq, u)
	}
	return uniq
}

// toRelPath trims the watch root prefix and returns a leading slash path.
func toRelPath(root, abs string) string {
	rel, err := filepath.Rel(root, abs)
	if err != nil {
		return ""
	}
	// If the path is outside the watch root, don't leak it.
	if rel == "." || strings.HasPrefix(rel, "..") {
		return ""
	}
	if !strings.HasPrefix(rel, string(os.PathSeparator)) {
		rel = string(os.PathSeparator) + rel
	}
	return rel
}

// zip helpers

type zipWriter struct {
	zw       *zip.Writer
	rootPath string
}

func newZipWriter(w http.ResponseWriter, root string) *zipWriter {
	return &zipWriter{zw: zip.NewWriter(w), rootPath: root}
}

func (z *zipWriter) AddFile(path string) error {
	rel, err := filepath.Rel(z.rootPath, path)
	if err != nil {
		return err
	}
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()
	info, err := f.Stat()
	if err != nil {
		return err
	}
	header, err := zip.FileInfoHeader(info)
	if err != nil {
		return err
	}
	header.Name = rel
	header.Method = zip.Deflate
	w, err := z.zw.CreateHeader(header)
	if err != nil {
		return err
	}
	_, err = io.Copy(w, f)
	return err
}

func (z *zipWriter) Close() error {
	return z.zw.Close()
}
