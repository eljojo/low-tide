// SPDX-License-Identifier: AGPL-3.0-only
package jobs

import (
	"crypto/tls"
	"fmt"
	"html"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	nethtml "golang.org/x/net/html"
	"low-tide/store"
)

// FetchAndSaveTitle attempts to fetch the page at url, parse the title/og:title,
// and update the job title in the DB.
func (m *Manager) FetchAndSaveTitle(jobID int64, urlStr string) {
	title, err := fetchTitle(urlStr)
	if err != nil {
		log.Printf("metadata: failed to fetch title for job %d (%s): %v", jobID, urlStr, err)
		return
	}
	if title == "" {
		return
	}

	log.Printf("metadata: found title for job %d: %q", jobID, title)
	if err := store.UpdateJobTitle(m.DB, jobID, title); err != nil {
		log.Printf("metadata: failed to update title db: %v", err)
		return
	}

	m.BroadcastJobSnapshot(jobID)
}

// fetches the "og:title" or <title> from a URL
func fetchTitle(urlStr string) (string, error) {
	log.Printf("metadata: fetching title for %s", urlStr)
	client := &http.Client{
		Timeout: 15 * time.Second,
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		},
	}

	req, err := http.NewRequest("GET", urlStr, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")

	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return "", fmt.Errorf("status code %d", resp.StatusCode)
	}

	// TODO: maybe Read first 512KB for parsing, to avoid huge downloads if it's not a normal page. TEST to make sure it works well.
	return parseHTMLTitle(resp.Body), nil
}

func parseHTMLTitle(r io.Reader) string {
	z := nethtml.NewTokenizer(r)
	var title string
	var inTitle bool

	// Loop until EOF or we find a good og:title
	for {
		tt := z.Next()
		switch tt {
		case nethtml.ErrorToken:
			// EOF or error, return whatever we have (likely <title>)
			return strings.TrimSpace(title)

		case nethtml.StartTagToken, nethtml.SelfClosingTagToken:
			t := z.Token()
			if t.Data == "title" {
				inTitle = true
			} else if t.Data == "meta" {
				var prop, content string
				for _, attr := range t.Attr {
					if attr.Key == "property" && attr.Val == "og:title" {
						prop = "og:title"
					}
					if attr.Key == "content" {
						content = attr.Val
					}
				}
				if prop == "og:title" && content != "" {
					// Found superior title, return immediately (attributes are already unescaped)
					return strings.TrimSpace(content)
				}
			}

		case nethtml.TextToken:
			if inTitle {
				// Text token data is raw, need unescaping
				title = html.UnescapeString(z.Token().Data)
				inTitle = false
			}

		case nethtml.EndTagToken:
			t := z.Token()
			if t.Data == "title" {
				inTitle = false
			}
			if t.Data == "head" {
				// If we leave <head> and didn't find og:title, settle for <title>
				return strings.TrimSpace(title)
			}
		}
	}
}
