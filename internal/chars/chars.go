package chars

const (
	LF  = byte(10)
	CR  = byte(13)
	NUL = byte(0)
)

var (
	// This is a hack because AI has issues with new lines when vibe coding LOL
	NewLine = string([]byte{LF})
)
