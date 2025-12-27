// SPDX-License-Identifier: AGPL-3.0-only
package config

import (
	"os"
	"regexp"

	"gopkg.in/yaml.v3"
)

// AppConfig represents a single download app definition.
type AppConfig struct {
	Name               string   `yaml:"name" json:"name"`
	ID                 string   `yaml:"id" json:"id"`
	Command            string   `yaml:"command" json:"command"` // e.g. "yt-dlp %u"
	Args               []string `yaml:"args" json:"args"`       // optional fixed args
	Regex              string   `yaml:"regex" json:"regex"`     // optional regex to auto-match URLs
	StripTrailingSlash bool     `yaml:"strip_trailing_slash" json:"strip_trailing_slash"`
}

func (c *Config) MatchAppForURL(u string) *AppConfig {
	for i, a := range c.Apps {
		if a.Regex == "" {
			continue
		}
		re, err := regexp.Compile(a.Regex)
		if err != nil {
			continue
		}
		if re.MatchString(u) {
			return &c.Apps[i]
		}
	}
	return nil
}

// Config is the top-level configuration structure.
type Config struct {
	ListenAddr string      `yaml:"listen_addr" json:"listen_addr"`
	DBPath     string      `yaml:"db_path" json:"db_path"`
	WatchDir   string      `yaml:"watch_dir" json:"watch_dir"`
	Apps       []AppConfig `yaml:"apps" json:"apps"`
}

// Load reads the YAML config file from path.
func Load(path string) (*Config, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	var cfg Config
	dec := yaml.NewDecoder(f)
	if err := dec.Decode(&cfg); err != nil {
		return nil, err
	}

	// Defaults
	if cfg.ListenAddr == "" {
		cfg.ListenAddr = ":8080"
	}
	if cfg.DBPath == "" {
		cfg.DBPath = "lowtide.db"
	}
	if cfg.WatchDir == "" {
		cfg.WatchDir = "downloads"
	}

	return &cfg, nil
}
