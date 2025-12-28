// SPDX-License-Identifier: AGPL-3.0-only
package store

import (
	"database/sql"
	"errors"
	"net/url"
	"strings"
	"time"
)

// JobStatus represents the lifecycle state of a job.
type JobStatus string

const (
	StatusQueued    JobStatus = "queued"
	StatusRunning   JobStatus = "running"
	StatusSuccess   JobStatus = "success"
	StatusFailed    JobStatus = "failed"
	StatusCancelled JobStatus = "cancelled"
	StatusCleaned   JobStatus = "cleaned"
)

type Job struct {
	ID           int64      `json:"id"`
	AppID        string     `json:"app_id"`
	URL          string     `json:"url"`
	Status       JobStatus  `json:"status"`
	PID          *int       `json:"pid,omitempty"`
	ExitCode     *int       `json:"exit_code,omitempty"`
	ErrorMessage *string    `json:"error_message,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
	StartedAt    *time.Time `json:"started_at,omitempty"`
	FinishedAt   *time.Time `json:"finished_at,omitempty"`
	Archived     bool       `json:"archived"`
	OriginalURL  string     `json:"original_url"`
	Title        string     `json:"title"`
	Logs         string     `json:"logs,omitempty"`
	Files        []JobFile  `json:"files,omitempty"`
}

type JobFile struct {
	ID        int64     `json:"id"`
	JobID     int64     `json:"job_id"`
	Path      string    `json:"path"`
	SizeBytes int64     `json:"size_bytes"`
	CreatedAt time.Time `json:"created_at"`
}

func Init(db *sql.DB) error {
	stmts := []string{
		`PRAGMA foreign_keys = ON;`,
		`CREATE TABLE IF NOT EXISTS jobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            app_id TEXT NOT NULL,
            url TEXT NOT NULL,
            status TEXT NOT NULL,
            pid INTEGER,
            exit_code INTEGER,
            error_message TEXT,
            created_at DATETIME NOT NULL,
            started_at DATETIME,
            finished_at DATETIME,
            archived INTEGER NOT NULL DEFAULT 0,
            original_url TEXT,
            title TEXT,
            logs TEXT
        );`,
		`CREATE TABLE IF NOT EXISTS job_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
            path TEXT NOT NULL,
            size_bytes INTEGER NOT NULL,
            created_at DATETIME NOT NULL
        );`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_job_files_job_path ON job_files(job_id, path);`,
	}
	for _, s := range stmts {
		if _, err := db.Exec(s); err != nil {
			return err
		}
	}
	return nil
}

func InsertJob(db *sql.DB, appID string, url string, createdAt time.Time) (int64, error) {
	if strings.TrimSpace(url) == "" {
		return 0, errors.New("no url")
	}
	title := url
	if u, err := parseURLTitle(url); err == nil {
		title = u
	}
	res, err := db.Exec(`INSERT INTO jobs (app_id, url, original_url, status, created_at, archived, title) VALUES (?, ?, ?, ?, ?, 0, ?)`, appID, url, url, StatusQueued, createdAt, title)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func parseURLTitle(raw string) (string, error) {
	r, err := url.Parse(strings.TrimSpace(raw))
	if err != nil {
		return "", err
	}
	p := r.Host + r.Path + r.RawQuery
	p = strings.TrimSuffix(p, "/")
	return p, nil
}

func scanJob(row interface{ Scan(dest ...interface{}) error }, includeLogs bool) (*Job, error) {
	var j Job
	var logs sql.NullString
	var urlStr string
	var status string
	var archivedInt int

	scanArgs := []interface{}{
		&j.ID, &j.AppID, &urlStr, &status, &j.PID, &j.ExitCode, &j.ErrorMessage,
		&j.CreatedAt, &j.StartedAt, &j.FinishedAt, &archivedInt, &j.OriginalURL, &j.Title,
	}
	if includeLogs {
		scanArgs = append(scanArgs, &logs)
	}

	// This is a bit of a hack to dynamically call Scan with the right number of arguments
	// because Scan doesn't support a variadic slice.
	switch len(scanArgs) {
	case 13:
		if err := row.Scan(scanArgs[0], scanArgs[1], scanArgs[2], scanArgs[3], scanArgs[4], scanArgs[5], scanArgs[6], scanArgs[7], scanArgs[8], scanArgs[9], scanArgs[10], scanArgs[11], scanArgs[12]); err != nil {
			return nil, err
		}
	case 14:
		if err := row.Scan(scanArgs[0], scanArgs[1], scanArgs[2], scanArgs[3], scanArgs[4], scanArgs[5], scanArgs[6], scanArgs[7], scanArgs[8], scanArgs[9], scanArgs[10], scanArgs[11], scanArgs[12], scanArgs[13]); err != nil {
			return nil, err
		}
	default:
		return nil, errors.New("invalid number of scan arguments")
	}

	j.Status = JobStatus(status)
	j.Archived = archivedInt != 0
	j.URL = urlStr
	if includeLogs {
		j.Logs = logs.String
	}
	return &j, nil
}

func GetJob(db *sql.DB, id int64) (*Job, error) {
	row := db.QueryRow(`SELECT id, app_id, url, status, pid, exit_code, error_message, created_at, started_at, finished_at, archived, original_url, title, logs FROM jobs WHERE id = ?`, id)
	return scanJob(row, true)
}


func ListJobsByStatus(db *sql.DB, status JobStatus) ([]Job, error) {
	rows, err := db.Query(`SELECT id, app_id, url, status, pid, exit_code, error_message, created_at, started_at, finished_at, archived, original_url, title, logs FROM jobs WHERE status = ?`, string(status))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Job
	for rows.Next() {
		j, err := scanJob(rows, true)
		if err != nil {
			return nil, err
		}
		out = append(out, *j)
	}
	return out, rows.Err()
}

func ListJobs(db *sql.DB, limit int) ([]Job, error) {
	q := `SELECT id, app_id, url, status, pid, exit_code, error_message, created_at, started_at, finished_at, archived, original_url, title FROM jobs`
	q += ` ORDER BY created_at DESC`
	if limit > 0 {
		q += ` LIMIT ?`
	}

	var rows *sql.Rows
	var err error
	if limit > 0 {
		rows, err = db.Query(q, limit)
	} else {
		rows, err = db.Query(q)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Job
	for rows.Next() {
		j, err := scanJob(rows, false)
		if err != nil {
			return nil, err
		}
		out = append(out, *j)
	}
	return out, rows.Err()
}

func UpdateJobStatusRunning(db *sql.DB, id int64, startedAt time.Time) error {
	_, err := db.Exec(`UPDATE jobs SET status = ?, started_at = ? WHERE id = ?`, StatusRunning, startedAt, id)
	return err
}

func UpdateJobPID(db *sql.DB, id int64, pid int) error {
	_, err := db.Exec(`UPDATE jobs SET pid = ? WHERE id = ?`, pid, id)
	return err
}

func ClearJobPID(db *sql.DB, id int64, exitCode int) error {
	_, err := db.Exec(`UPDATE jobs SET pid = NULL, exit_code = ? WHERE id = ?`, exitCode, id)
	return err
}

func MarkJobSuccess(db *sql.DB, id int64, finishedAt time.Time, logs string) error {
	_, err := db.Exec(`UPDATE jobs SET status = ?, finished_at = ?, logs = ? WHERE id = ?`, StatusSuccess, finishedAt, logs, id)
	return err
}

func MarkJobCancelled(db *sql.DB, id int64, finishedAt time.Time, logs string) error {
	_, err := db.Exec(`UPDATE jobs SET status = ?, finished_at = ?, logs = ? WHERE id = ?`, StatusCancelled, finishedAt, logs, id)
	return err
}

func MarkJobFailed(db *sql.DB, id int64, finishedAt time.Time, msg string, logs string) error {
	_, err := db.Exec(`UPDATE jobs SET status = ?, finished_at = ?, error_message = ?, logs = ? WHERE id = ?`, StatusFailed, finishedAt, msg, logs, id)
	return err
}

func MarkJobCleaned(db *sql.DB, id int64) error {
	_, err := db.Exec(`UPDATE jobs SET status = ?, archived = 1 WHERE id = ?`, StatusCleaned, id)
	return err
}

func ResetJobForRetry(db *sql.DB, id int64) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.Exec(`UPDATE jobs SET status=?, pid=NULL, exit_code=NULL, error_message=NULL, started_at=NULL, finished_at=NULL, logs=NULL, archived=0 WHERE id=?`, StatusQueued, id); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM job_files WHERE job_id = ?`, id); err != nil {
		return err
	}
	return tx.Commit()
}



func ArchiveJob(db *sql.DB, id int64) error {
	_, err := db.Exec(`UPDATE jobs SET archived = 1 WHERE id = ?`, id)
	return err
}

func UpdateJobTitle(db *sql.DB, id int64, title string) error {
	_, err := db.Exec(`UPDATE jobs SET title = ? WHERE id = ?`, title, id)
	return err
}

func InsertJobFile(db *sql.DB, jobID int64, path string, size int64, createdAt time.Time) error {
	// Use UPSERT semantics so concurrent inserts by path/job coalesce atomically.
	_, err := db.Exec(`INSERT INTO job_files (job_id, path, size_bytes, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(job_id, path) DO UPDATE SET size_bytes = excluded.size_bytes, created_at = excluded.created_at`, jobID, path, size, createdAt)
	return err
}

func DeleteJobFileByPath(db *sql.DB, jobID int64, path string) error {
	_, err := db.Exec(`DELETE FROM job_files WHERE job_id = ? AND path = ?`, jobID, path)
	return err
}

func GetJobFileByID(db *sql.DB, id int64) (*JobFile, error) {
	row := db.QueryRow(`SELECT id, job_id, path, size_bytes, created_at FROM job_files WHERE id = ?`, id)
	var f JobFile
	if err := row.Scan(&f.ID, &f.JobID, &f.Path, &f.SizeBytes, &f.CreatedAt); err != nil {
		return nil, err
	}
	return &f, nil
}

func JobFileExists(db *sql.DB, jobID int64, path string) (bool, error) {
	row := db.QueryRow(`SELECT COUNT(1) FROM job_files WHERE job_id = ? AND path = ?`, jobID, path)
	var cnt int
	if err := row.Scan(&cnt); err != nil {
		return false, err
	}
	return cnt > 0, nil
}

func ListJobFiles(db *sql.DB, jobID int64) ([]JobFile, error) {
	rows, err := db.Query(`SELECT id, job_id, path, size_bytes, created_at FROM job_files WHERE job_id = ? ORDER BY created_at ASC`, jobID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var files []JobFile
	for rows.Next() {
		var f JobFile
		if err := rows.Scan(&f.ID, &f.JobID, &f.Path, &f.SizeBytes, &f.CreatedAt); err != nil {
			return nil, err
		}
		files = append(files, f)
	}
	return files, rows.Err()
}
