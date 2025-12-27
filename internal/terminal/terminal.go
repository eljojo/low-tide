package terminal

import (
	"bytes"
	"github.com/buildkite/terminal-to-html/v3"
	"low-tide/internal/chars"
	"regexp"
	"strconv"
	"sync"
)

type Cell struct {
	Char  byte
	Style []byte // The ANSI SGR sequence active when this char was written
}

type Terminal struct {
	mu           sync.Mutex
	lines        [][]Cell
	maxLines     int
	cursorY      int
	cursorX      int
	currentStyle []byte
}

var reCSI = regexp.MustCompile(`^(\d*)(?:;(\d*))?([a-zA-Z])`)

func New(maxLines int) *Terminal {
	t := &Terminal{
		maxLines: maxLines,
	}
	t.resetBuffer()
	return t
}

func (t *Terminal) resetBuffer() {
	t.lines = make([][]Cell, t.maxLines)
	for i := range t.lines {
		t.lines[i] = []Cell{}
	}
	t.cursorY = 0
	t.cursorX = 0
	t.currentStyle = chars.ANSI_Reset
}

func (t *Terminal) Write(data []byte) {
	t.mu.Lock()
	defer t.mu.Unlock()

	i := 0
	for i < len(data) {
		b := data[i]

		if b == chars.ESC && i+1 < len(data) && data[i+1] == '[' {
			// Found CSI sequence
			seq := chars.Re_ANSI.Find(data[i:])
			if seq != nil {
				t.handleCSI(seq)
				i += len(seq)
				continue
			}
		}

		switch b {
		case chars.LF:
			t.cursorY++
			t.ensureCursorY()
		case chars.CR:
			t.cursorX = 0
		case '\b':
			if t.cursorX > 0 {
				t.cursorX--
			}
		case '	':
			// Tabs: move to next multiple of 8
			t.cursorX = (t.cursorX/8 + 1) * 8
		default:
			if b >= 32 {
				t.writeCell(b)
			}
		}
		i++
	}
}

func (t *Terminal) handleCSI(fullSeq []byte) {
	payload := string(fullSeq[2:])
	match := reCSI.FindStringSubmatch(payload)
	if match == nil {
		return
	}

	p1, _ := strconv.Atoi(match[1])
	p2, _ := strconv.Atoi(match[2])
	cmd := match[3]

	switch cmd {
	case "m": // SGR - Style
		// We capture the entire sequence to apply to future characters
		t.currentStyle = append([]byte{}, fullSeq...)
	case "A": // Up
		if p1 == 0 { p1 = 1 }
		t.cursorY -= p1
	case "B": // Down
		if p1 == 0 { p1 = 1 }
		t.cursorY += p1
	case "C": // Right
		if p1 == 0 { p1 = 1 }
		t.cursorX += p1
	case "D": // Left
		if p1 == 0 { p1 = 1 }
		t.cursorX -= p1
		if t.cursorX < 0 { t.cursorX = 0 }
	case "H", "f": // Home / Position
		if p1 > 0 { t.cursorY = p1 - 1 } else { t.cursorY = 0 }
		if p2 > 0 { t.cursorX = p2 - 1 } else { t.cursorX = 0 }
	case "J": // Clear Screen
		if p1 == 2 {
			t.resetBuffer()
		}
	case "K": // Clear Line
		if p1 == 0 { // Clear from cursor to end of line
			if t.cursorY >= 0 && t.cursorY < len(t.lines) {
				if t.cursorX < len(t.lines[t.cursorY]) {
					t.lines[t.cursorY] = t.lines[t.cursorY][:t.cursorX]
				}
			}
		} else if p1 == 2 { // Clear entire line
			if t.cursorY >= 0 && t.cursorY < len(t.lines) {
				t.lines[t.cursorY] = []Cell{}
			}
		}
	}
	t.ensureCursorY()
}

func (t *Terminal) ensureCursorY() {
	if t.cursorY < 0 {
		t.cursorY = 0
	}
	if t.cursorY >= t.maxLines {
		diff := t.cursorY - (t.maxLines - 1)
		copy(t.lines, t.lines[diff:])
		for j := t.maxLines - diff; j < t.maxLines; j++ {
			t.lines[j] = []Cell{}
		}
		t.cursorY = t.maxLines - 1
	}
}

func (t *Terminal) writeCell(b byte) {
	line := t.lines[t.cursorY]
	newCell := Cell{Char: b, Style: t.currentStyle}

	if t.cursorX > len(line) {
		padding := make([]Cell, t.cursorX-len(line))
		for j := range padding {
			padding[j] = Cell{Char: ' ', Style: chars.ANSI_Reset}
		}
		line = append(line, padding...)
	}

	if t.cursorX < len(line) {
		line[t.cursorX] = newCell
	} else {
		line = append(line, newCell)
	}
	t.lines[t.cursorY] = line
	t.cursorX++
}

func (t *Terminal) RenderHTML() string {
	t.mu.Lock()
	defer t.mu.Unlock()

	var buf bytes.Buffer
	first := -1
	last := -1

	for i, line := range t.lines {
		hasContent := false
		for _, cell := range line {
			if cell.Char != ' ' && cell.Char != 0 {
				hasContent = true
				break
			}
		}
		if hasContent {
			if first == -1 { first = i }
			last = i
		}
	}

	if first == -1 {
		return ""
	}

	if t.cursorY > last {
		last = t.cursorY
	}

	var activeStyle []byte
	for i := first; i <= last; i++ {
		for _, cell := range t.lines[i] {
			// Only write style if it changed to keep HTML payload smaller
			if !bytes.Equal(cell.Style, activeStyle) {
				buf.Write(cell.Style)
				activeStyle = cell.Style
			}
			buf.WriteByte(cell.Char)
		}
		buf.WriteByte(chars.LF)
	}
	
	return string(terminal.Render(buf.Bytes()))
}

func (t *Terminal) Clear() {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.resetBuffer()
}
