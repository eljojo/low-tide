package store

import (
	"database/sql"
	"errors"
	"fmt"
	"net/url"
	"path/filepath"
	"strings"
	"time"
)

func depth(p string) int {
	p = filepath.Clean(p)
	if p == string(filepath.Separator) {
		return 0
	}
	return len(strings.Split(p, string(filepath.Separator)))
}

func isSubpath(parent, child string) bool {
	rel, err := filepath.Rel(parent, child)
	if err != nil {
		return false
	}
	return rel != "." && !strings.HasPrefix(rel, "..")
}

// JobStatus represents the lifecycle state of a job.
type JobStatus string

const (
	StatusQueued  JobStatus = "queued"
	StatusRunning JobStatus = "running"
	StatusSuccess JobStatus = "success"
	StatusFailed  JobStatus = "failed"
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

// LogLine represents an in-memory log entry to persist.
type LogLine struct {
	Line string
	When time.Time
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
	// Ensure columns exist for older DBs
	if err := ensureColumn(db, "jobs", "original_url", "TEXT"); err != nil {
		return err
	}
	if err := ensureColumn(db, "jobs", "title", "TEXT"); err != nil {
		return err
	}
	return ensureColumn(db, "jobs", "logs", "TEXT")
}

func ensureColumn(db *sql.DB, table, column, colType string) error {
	rows, err := db.Query(fmt.Sprintf("PRAGMA table_info(%s)", table))
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var cid int
		var name string
		var ctype string
		var notnull int
		var dfltValue sql.NullString
		var pk int
		if err := rows.Scan(&cid, &name, &ctype, &notnull, &dfltValue, &pk); err != nil {
			return err
		}
		if name == column {
			return nil
		}
	}
	if err := rows.Err(); err != nil {
		return err
	}

	_, err = db.Exec(fmt.Sprintf("ALTER TABLE %s ADD COLUMN %s %s", table, column, colType))
	return err
}

func InsertJob(db *sql.DB, appID string, url string, createdAt time.Time) (int64, error) {
	if strings.TrimSpace(url) == "" {
		return 0, errors.New("no url")
	}
	// Compute initial title from URL (host + path) so jobs show meaningful titles
	title := url
	if u, err := parseURLTitle(url); err == nil {
		title = u
	}
	res, err := db.Exec(`INSERT INTO jobs (app_id, url, original_url, status, created_at, archived, title) VALUES (?, ?, ?, 'queued', ?, 0, ?)`, appID, url, url, createdAt, title)
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
	// Host + path
	p := r.Host + r.Path
	if p == "" {
		return r.Path, nil
	}
	// Trim trailing slash
	p = strings.TrimSuffix(p, "/")
	return p, nil
}

func scanJob(row interface {
	Scan(dest ...interface{}) error
}) (*Job, error) {
	var j Job
	var urlStr string
	var status string
	var archivedInt int
	var logs sql.NullString
	if err := row.Scan(&j.ID, &j.AppID, &urlStr, &status, &j.PID, &j.ExitCode, &j.ErrorMessage, &j.CreatedAt, &j.StartedAt, &j.FinishedAt, &archivedInt, &j.OriginalURL, &j.Title, &logs); err != nil {
		return nil, err
	}
	j.Status = JobStatus(status)
	j.Archived = archivedInt != 0
	j.URL = urlStr
	j.Logs = logs.String
	return &j, nil
}

func GetJob(db *sql.DB, id int64) (*Job, error) {
	row := db.QueryRow(`SELECT id, app_id, url, status, pid, exit_code, error_message, created_at, started_at, finished_at, archived, original_url, title, logs FROM jobs WHERE id = ?`, id)
	return scanJob(row)
}

func ListJobs(db *sql.DB, limit int) ([]Job, error) {
	q := `SELECT id, app_id, url, status, pid, exit_code, error_message, created_at, started_at, finished_at, archived, original_url, title, logs FROM jobs`
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
		j, err := scanJob(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *j)
	}
	return out, rows.Err()
}

func UpdateJobStatusRunning(db *sql.DB, id int64, startedAt time.Time) error {
	_, err := db.Exec(`UPDATE jobs SET status = 'running', started_at = ? WHERE id = ?`, startedAt, id)
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

func MarkJobSuccess(db *sql.DB, id int64, finishedAt time.Time) error {
	_, err := db.Exec(`UPDATE jobs SET status = 'success', finished_at = ? WHERE id = ?`, finishedAt, id)
	return err
}

func MarkJobFailed(db *sql.DB, id int64, finishedAt time.Time, msg string) error {
	_, err := db.Exec(`UPDATE jobs SET status = 'failed', finished_at = ?, error_message = ? WHERE id = ?`, finishedAt, msg, id)
	return err
}

func ResetJobForRetry(db *sql.DB, id int64) error {
	_, err := db.Exec(`UPDATE jobs SET status='queued', pid=NULL, exit_code=NULL, error_message=NULL, started_at=NULL, finished_at=NULL, logs=NULL WHERE id=?`, id)
	return err
}

func ArchiveFinishedJobs(db *sql.DB) error {
	_, err := db.Exec(`UPDATE jobs SET archived = 1 WHERE archived = 0 AND status IN ('success','failed')`)
	return err
}

func ArchiveJob(db *sql.DB, id int64) error {
	_, err := db.Exec(`UPDATE jobs SET archived = 1 WHERE id = ?`, id)
	return err
}

func UpdateJobTitle(db *sql.DB, id int64, title string) error {
	_, err := db.Exec(`UPDATE jobs SET title = ? WHERE id = ?`, title, id)
	return err
}

func UpdateJobLogs(db *sql.DB, id int64, logs string) error {
	_, err := db.Exec(`UPDATE jobs SET logs = ? WHERE id = ?`, logs, id)
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

func GetJobFileByPath(db *sql.DB, path string) (*JobFile, error) {
	row := db.QueryRow(`SELECT id, job_id, path, size_bytes, created_at FROM job_files WHERE path = ? LIMIT 1`, path)
	var f JobFile
	if err := row.Scan(&f.ID, &f.JobID, &f.Path, &f.SizeBytes, &f.CreatedAt); err != nil {
		return nil, err
	}
	return &f, nil
}

// GetJobFileByPathForJob finds a job_file record by job_id+path. Use this when
// you know which job the file belongs to to avoid cross-job collisions.
func GetJobFileByPathForJob(db *sql.DB, jobID int64, path string) (*JobFile, error) {
	row := db.QueryRow(`SELECT id, job_id, path, size_bytes, created_at FROM job_files WHERE job_id = ? AND path = ? LIMIT 1`, jobID, path)
	var f JobFile
	if err := row.Scan(&f.ID, &f.JobID, &f.Path, &f.SizeBytes, &f.CreatedAt); err != nil {
		return nil, err
	}
	return &f, nil
}

func UpdateJobFileSize(db *sql.DB, jobID int64, path string, size int64, createdAt time.Time) error {
	_, err := db.Exec(`UPDATE job_files SET size_bytes = ?, created_at = ? WHERE job_id = ? AND path = ?`, size, createdAt, jobID, path)
	return err
}

func ListJobFilesByPath(db *sql.DB, path string) ([]JobFile, error) {
	rows, err := db.Query(`SELECT id, job_id, path, size_bytes, created_at FROM job_files WHERE path = ?`, path)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []JobFile
	for rows.Next() {
		var f JobFile
		if err := rows.Scan(&f.ID, &f.JobID, &f.Path, &f.SizeBytes, &f.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, f)
	}
	return out, rows.Err()
}

// JobFileExists checks whether a file path already exists for the job.
func JobFileExists(db *sql.DB, jobID int64, path string) (bool, error) {
	row := db.QueryRow(`SELECT COUNT(1) FROM job_files WHERE job_id = ? AND path = ?`, jobID, path)
	var cnt int
	if err := row.Scan(&cnt); err != nil {
		return false, err
	}
	return cnt > 0, nil
}

func CountJobArtifacts(db *sql.DB, jobID int64) (fileCount int, err error) {
	// Count files directly and derive directories from file parents.
	row := db.QueryRow(`SELECT COUNT(1) FROM job_files WHERE job_id = ?`, jobID)
	if err = row.Scan(&fileCount); err != nil {
		return
	}
	return
}

func GetPrimaryJobFile(db *sql.DB, jobID int64) (*JobFile, error) {
	row := db.QueryRow(`SELECT id, job_id, path, size_bytes, created_at FROM job_files WHERE job_id = ? ORDER BY created_at ASC LIMIT 1`, jobID)
	var f JobFile
	if err := row.Scan(&f.ID, &f.JobID, &f.Path, &f.SizeBytes, &f.CreatedAt); err != nil {
		return nil, err
	}
	return &f, nil
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

func UnarchiveJob(db *sql.DB, id int64) error {
	_, err := db.Exec(`UPDATE jobs SET archived = 0 WHERE id = ?`, id)
	return err
}

func DeleteJobFilesAndDirs(db *sql.DB, jobID int64) error {
	_, err := db.Exec(`DELETE FROM job_files WHERE job_id = ?`, jobID)
	if err != nil {
		return err
	}
	return nil
}

func DeleteJob(db *sql.DB, jobID int64) error {
	_, err := db.Exec(`DELETE FROM jobs WHERE id = ?`, jobID)
	return err
}

// GetJobPaths is a synonym for ListJobFiles, kept for compatibility.
func GetJobPaths(db *sql.DB, jobID int64) ([]JobFile, error) {
	return ListJobFiles(db, jobID)
}

// DeleteJobLogs clears the logs column for a job.
func DeleteJobLogs(db *sql.DB, jobID int64) error {
	_, err := db.Exec(`UPDATE jobs SET logs = NULL WHERE id = ?`, jobID)
	return err
}

// DeleteLogsForArchivedJobs clears logs for all archived jobs.
func DeleteLogsForArchivedJobs(db *sql.DB) error {
	_, err := db.Exec(`UPDATE jobs SET logs = NULL WHERE archived = 1`)
	return err
}
