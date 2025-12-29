// SPDX-License-Identifier: AGPL-3.0-only
package jobs

import (
	"crypto/tls"
	"fmt"
	"html"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"

	nethtml "golang.org/x/net/html"
	"low-tide/store"
)

// FetchAndSaveMetadata attempts to fetch the page at url, parse the title/og:title and og:image,
// download the image if found, and update the job in the DB.
func (m *Manager) FetchAndSaveMetadata(jobID int64, urlStr string) {
	metadata, err := fetchMetadata(urlStr)
	if err != nil {
		log.Printf("metadata: failed to fetch metadata for job %d (%s): %v", jobID, urlStr, err)
		return
	}

	if metadata.Title != "" {
		log.Printf("metadata: found title for job %d: %q", jobID, metadata.Title)
		if err := store.UpdateJobTitle(m.DB, jobID, metadata.Title); err != nil {
			log.Printf("metadata: failed to update title db: %v", err)
		}
	}

	if metadata.ImageURL != "" {
		imagePath, err := m.downloadAndSaveImage(jobID, metadata.ImageURL)
		if err != nil {
			log.Printf("metadata: failed to download image for job %d (%s): %v", jobID, metadata.ImageURL, err)
		} else if imagePath != "" {
			log.Printf("metadata: saved image for job %d: %s", jobID, imagePath)
			if err := store.UpdateJobImagePath(m.DB, jobID, imagePath); err != nil {
				log.Printf("metadata: failed to update image path db: %v", err)
			}
		}
	}

	m.BroadcastJobSnapshot(jobID)
}

type Metadata struct {
	Title    string
	ImageURL string
}

// downloadAndSaveImage downloads an image from the given URL and saves it to the thumbnails directory
func (m *Manager) downloadAndSaveImage(jobID int64, imageURL string) (string, error) {
	thumbnailsDir := filepath.Join(m.downloadsRoot, "thumbnails")
	if err := os.MkdirAll(thumbnailsDir, 0o755); err != nil {
		return "", fmt.Errorf("failed to create thumbnails directory: %v", err)
	}

	client := &http.Client{
		Timeout: 30 * time.Second,
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		},
	}

	resp, err := client.Get(imageURL)
	if err != nil {
		return "", fmt.Errorf("failed to download image: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return "", fmt.Errorf("image download failed with status code %d", resp.StatusCode)
	}

	ext := getImageExtension(resp.Header.Get("Content-Type"), imageURL)
	if ext == "" {
		return "", fmt.Errorf("unsupported image type")
	}

	fileName := fmt.Sprintf("%d%s", jobID, ext)
	filePath := filepath.Join(thumbnailsDir, fileName)

	file, err := os.Create(filePath)
	if err != nil {
		return "", fmt.Errorf("failed to create image file: %v", err)
	}
	defer file.Close()

	_, err = io.Copy(file, io.LimitReader(resp.Body, 5*1024*1024)) // Limit to 5MB
	if err != nil {
		return "", fmt.Errorf("failed to save image data: %v", err)
	}

	// Return relative path for storage in DB
	return filepath.Join("thumbnails", fileName), nil
}

// fetchMetadata fetches both title and image metadata from a URL
func fetchMetadata(urlStr string) (*Metadata, error) {
	log.Printf("metadata: fetching metadata for %s", urlStr)
	client := &http.Client{
		Timeout: 15 * time.Second,
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		},
	}

	req, err := http.NewRequest("GET", urlStr, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("status code %d", resp.StatusCode)
	}

	bodyReader := io.LimitReader(resp.Body, 1024*1024) // 1MB (youtube hides the title deep)
	return parseHTMLMetadata(bodyReader, urlStr), nil
}

func parseHTMLMetadata(r io.Reader, baseURL string) *Metadata {
	z := nethtml.NewTokenizer(r)
	var pageTitle string
	var ogTitle string
	var imageURL string
	var inTitle bool

	// Loop until EOF or we find both og:title and og:image
	for {
		tt := z.Next()
		switch tt {
		case nethtml.ErrorToken:
			// EOF or error, return whatever we have
			finalTitle := ogTitle
			if finalTitle == "" {
				finalTitle = pageTitle
			}
			return &Metadata{
				Title:    strings.TrimSpace(finalTitle),
				ImageURL: resolveImageURL(imageURL, baseURL),
			}

		case nethtml.StartTagToken, nethtml.SelfClosingTagToken:
			t := z.Token()
			if t.Data == "title" {
				inTitle = true
			} else if t.Data == "meta" {
				var prop, content string
				for _, attr := range t.Attr {
					if attr.Key == "property" {
						prop = attr.Val
					}
					if attr.Key == "content" {
						content = attr.Val
					}
				}
				if prop == "og:title" && content != "" {
					ogTitle = content
				} else if prop == "og:image" && content != "" {
					imageURL = content
				}
			}

		case nethtml.TextToken:
			if inTitle {
				// Text token data is raw, need unescaping
				pageTitle = html.UnescapeString(z.Token().Data)
				inTitle = false
			}

		case nethtml.EndTagToken:
			t := z.Token()
			if t.Data == "title" {
				inTitle = false
			}
			if t.Data == "head" {
				// If we leave <head>, return what we have
				finalTitle := ogTitle
				if finalTitle == "" {
					finalTitle = pageTitle
				}
				return &Metadata{
					Title:    strings.TrimSpace(finalTitle),
					ImageURL: resolveImageURL(imageURL, baseURL),
				}
			}
		}
	}
}

// getImageExtension determines the file extension from content type or URL
func getImageExtension(contentType, imageURL string) string {
	switch strings.ToLower(contentType) {
	case "image/jpeg":
		return ".jpg"
	case "image/png":
		return ".png"
	case "image/gif":
		return ".gif"
	case "image/webp":
		return ".webp"
	case "image/svg+xml":
		return ".svg"
	}

	parsedURL, err := url.Parse(imageURL)
	if err != nil {
		return ""
	}

	ext := strings.ToLower(path.Ext(parsedURL.Path))
	switch ext {
	case ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg":
		return ext
	default:
		return "" // don't download if we don't recognize the type
	}
}

// resolveImageURL converts relative URLs to absolute URLs
func resolveImageURL(imageURL, baseURL string) string {
	if imageURL == "" {
		return ""
	}

	// If it's already an absolute URL, return as is
	if strings.HasPrefix(imageURL, "http://") || strings.HasPrefix(imageURL, "https://") {
		return imageURL
	}

	base, err := url.Parse(baseURL)
	if err != nil {
		return imageURL // Return original if we can't parse base
	}

	// Handle protocol-relative URLs (//example.com/image.jpg)
	if strings.HasPrefix(imageURL, "//") {
		return base.Scheme + ":" + imageURL
	}

	// Resolve relative URL
	resolved, err := base.Parse(imageURL)
	if err != nil {
		return imageURL // Return original if we can't resolve
	}

	return resolved.String()
}
