// SPDX-License-Identifier: AGPL-3.0-only
package main

import (
	"archive/zip"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"mime"
	"net/url"
	"path/filepath"

	"bufio"
)

func contentDisposition(filename string) string {
	base := filepath.Base(filename)

	return mime.FormatMediaType("attachment", map[string]string{
		"filename":  base,                             // quoted-string
		"filename*": "UTF-8''" + url.PathEscape(base), // RFC 5987
	})
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
	scanner := bufio.NewScanner(strings.NewReader(s))
	seen := map[string]struct{}{}
	var out []string

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}

		for _, rawURL := range strings.Fields(line) {
			u, err := url.ParseRequestURI(rawURL)
			if err != nil || (u.Scheme != "http" && u.Scheme != "https") {
				log.Printf("skipping invalid URL: %q (err=%v)", rawURL, err)
				continue
			}

			f := u.String()
			if _, ok := seen[f]; ok {
				continue
			}
			seen[f] = struct{}{}
			out = append(out, f)
		}
	}

	return out
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
