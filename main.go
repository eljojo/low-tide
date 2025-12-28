// SPDX-License-Identifier: AGPL-3.0-only
package main

import (
	"database/sql"
	"log"
	"net/http"
	"os"
	"path/filepath"

	_ "github.com/mattn/go-sqlite3"

	"low-tide/config"
	"low-tide/jobs"
	"low-tide/store"
)

func main() {
	log.Printf("Starting Low Tide ⛵️")

	cfgPath := "config/config.yaml"
	if env := os.Getenv("LOWTIDE_CONFIG"); env != "" {
		cfgPath = env
	}

	cfg, err := config.Load(cfgPath)
	if err != nil {
		log.Fatalf("load config: %v", err)
	}

	db, err := sql.Open("sqlite3", cfg.DBPath+"?_fk=1")
	if err != nil {
		log.Fatalf("open db: %v", err)
	}
	defer db.Close()

	if err := store.Init(db); err != nil {
		log.Fatalf("init db: %v", err)
	}

	// Normalize downloads dir
	cfg.DownloadsDir, err = filepath.Abs(cfg.DownloadsDir)
	if err != nil {
		log.Fatalf("abs downloads_dir: %v", err)
	}

	mgr, err := jobs.NewManager(db, cfg)
	if err != nil {
		log.Fatalf("new manager: %v", err)
	}
	mgr.RecoverJobs()

	srv := NewServer(db, cfg, mgr)

	log.Printf("🌊 Low Tide listening on %s", cfg.ListenAddr)
	log.Fatal(http.ListenAndServe(cfg.ListenAddr, srv.Routes()))
}
