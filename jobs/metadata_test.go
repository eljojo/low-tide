package jobs

import (
	"strings"
	"testing"
)

func TestParseHTMLMetadata(t *testing.T) {
	tests := []struct {
		name     string
		html     string
		baseURL  string
		expected *Metadata
	}{
		{
			name: "Standard title and og:image",
			html: `<html><head>
				<title>Page Title</title>
				<meta property="og:image" content="http://example.com/image.png">
			</head></html>`,
			baseURL: "http://example.com",
			expected: &Metadata{
				Title:    "Page Title",
				ImageURL: "http://example.com/image.png",
			},
		},
		{
			name: "OG Title preferred over Title",
			html: `<html><head>
				<title>Page Title</title>
				<meta property="og:title" content="OG Title">
			</head></html>`,
			baseURL: "http://example.com",
			expected: &Metadata{
				Title:    "OG Title",
				ImageURL: "",
			},
		},
		{
			name: "Relative OG Image",
			html: `<html><head>
				<meta property="og:image" content="/images/thumb.jpg">
			</head></html>`,
			baseURL: "https://mysite.com/page",
			expected: &Metadata{
				Title:    "",
				ImageURL: "https://mysite.com/images/thumb.jpg",
			},
		},
		{
			name: "Escaped title",
			html: `<html><head>
				<title>This &amp; That</title>
			</head></html>`,
			baseURL: "http://example.com",
			expected: &Metadata{
				Title:    "This & That",
				ImageURL: "",
			},
		},
		{
			name: "Stop at head",
			html: `<html><head>
				<title>Head Title</title>
			</head><body>
				<title>Body Title</title>
			</body></html>`,
			baseURL: "http://example.com",
			expected: &Metadata{
				Title:    "Head Title",
				ImageURL: "",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := parseHTMLMetadata(strings.NewReader(tt.html), tt.baseURL)
			if got.Title != tt.expected.Title {
				t.Errorf("expected Title %q, got %q", tt.expected.Title, got.Title)
			}
			if got.ImageURL != tt.expected.ImageURL {
				t.Errorf("expected ImageURL %q, got %q", tt.expected.ImageURL, got.ImageURL)
			}
		})
	}
}

func TestGetImageExtension(t *testing.T) {
	tests := []struct {
		contentType string
		imageURL    string
		expected    string
	}{
		{"image/jpeg", "http://ex.com/a", ".jpg"},
		{"image/png", "http://ex.com/a", ".png"},
		{"image/gif", "http://ex.com/a", ".gif"},
		{"image/webp", "http://ex.com/a", ".webp"},
		{"image/svg+xml", "http://ex.com/a", ".svg"},
		{"application/octet-stream", "http://ex.com/image.jpg", ".jpg"},
		{"unknown", "http://ex.com/image.PNG", ".png"},
		{"", "http://ex.com/image.webp", ".webp"},
		{"text/html", "http://ex.com/not-an-image", ""},
	}

	for _, tt := range tests {
		got := getImageExtension(tt.contentType, tt.imageURL)
		if got != tt.expected {
			t.Errorf("getImageExtension(%q, %q) = %q; want %q", tt.contentType, tt.imageURL, got, tt.expected)
		}
	}
}

func TestResolveImageURL(t *testing.T) {
	tests := []struct {
		imageURL string
		baseURL  string
		expected string
	}{
		{"http://absolute.com/i.png", "http://base.com", "http://absolute.com/i.png"},
		{"/relative/i.png", "http://base.com", "http://base.com/relative/i.png"},
		{"//protocol-relative.com/i.png", "https://base.com", "https://protocol-relative.com/i.png"},
		{"relative.png", "http://base.com/subdir/", "http://base.com/subdir/relative.png"},
		{"", "http://base.com", ""},
		{"relative.png", "<script>", ""},
	}

	for _, tt := range tests {
		got := resolveImageURL(tt.imageURL, tt.baseURL)
		if got != tt.expected {
			t.Errorf("resolveImageURL(%q, %q) = %q; want %q", tt.imageURL, tt.baseURL, got, tt.expected)
		}
	}
}
