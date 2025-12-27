package chars

import "regexp"

const (
	LF  = byte(10)
	CR  = byte(13)
	NUL = byte(0)
	ESC = byte(27)
)

var (
	// NewLine is a hack because AI has issues with new lines when vibe coding LOL
	NewLine = string([]byte{LF})

	// Sequential ANSI Sequence Matcher
	// This matches most common CSI (Control Sequence Introducer) sequences
	Re_ANSI = regexp.MustCompile(`\x1b\[[0-9;?]*[a-zA-Z]`)

	// Terminal control sequences
	ANSI_Reset = []byte("\x1b[0m")
)
