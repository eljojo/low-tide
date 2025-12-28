package cleanup

import (
	"io/fs"
	"log"
	"os"
	"path/filepath"
)

// DeleteEmptyFolders recursively deletes all empty subdirectories within a given root directory.
// It performs a post-order traversal to ensure that directories that become empty as a result of
// their children being deleted are also removed. The root directory itself will not be deleted.
func DeleteEmptyFolders(root string) error {
	root = filepath.Clean(root)

	absRoot, err := filepath.Abs(root)
	if err != nil {
		log.Fatal(err)
	}

	cleanedUp := false
	var dirs []string
	if err := filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			dirs = append(dirs, path)
		}
		return nil
	}); err != nil {
		return err
	}

	for i := len(dirs) - 1; i >= 0; i-- {
		path := dirs[i]
		if filepath.Clean(path) == root {
			continue
		}
		entries, err := os.ReadDir(path)
		if err != nil || len(entries) != 0 {
			continue
		}
		err = os.Remove(path) // best effort
		if err != nil {
			log.Fatal(err)
		}
		cleanedUp = true
	}
	if cleanedUp {
		log.Printf("Cleaned-up empty folders in %s", absRoot)
	}

	return nil
}
