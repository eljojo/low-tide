package terminal

import (
	"bytes"
	"fmt"
	ansi "github.com/buildkite/terminal-to-html/v3"
	"low-tide/internal/chars"
	"regexp"
	"strconv"
	"sync"
)

type Cell struct {
	Char  byte
	Style []byte
}

type Terminal struct {
	mu           sync.Mutex
	lines        [][]Cell
	maxLines     int
	cursorY      int
	cursorX      int
	currentStyle []byte
	dirty        map[int]bool
}

var reCSI = regexp.MustCompile(`^(\d*)(?:;(\d*))?([a-zA-Z])`)

func New(maxLines int) *Terminal {
	t := &Terminal{
		maxLines: maxLines,
		dirty:    make(map[int]bool),
	}
	t.resetBuffer()
	return t
}

func (t *Terminal) resetBuffer() {
	t.lines = make([][]Cell, t.maxLines)
	for i := range t.lines {
		t.lines[i] = []Cell{}
		t.dirty[i] = true
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
		case chars.TAB:
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
	case "m": // We capture the entire sequence to apply to future characters
		t.currentStyle = append([]byte{}, fullSeq...)
	case "A": // Up
		if p1 == 0 {
			p1 = 1
		}
		t.cursorY -= p1
	case "B": // Down
		if p1 == 0 {
			p1 = 1
		}
		t.cursorY += p1
	case "C": // Right
		if p1 == 0 {
			p1 = 1
		}
		t.cursorX += p1
	case "D": // Left
		if p1 == 0 {
			p1 = 1
		}
		t.cursorX -= p1
		if t.cursorX < 0 {
			t.cursorX = 0
		}
	case "H", "f": // Home / Position
		if p1 > 0 {
			t.cursorY = p1 - 1
		} else {
			t.cursorY = 0
		}
		if p2 > 0 {
			t.cursorX = p2 - 1
		} else {
			t.cursorX = 0
		}
	case "J": // Clear Screen
		if p1 == 2 {
			t.resetBuffer()
		}
	case "K": // Clear Line
		if p1 == 0 { // Clear from cursor to end of line
			if t.cursorY >= 0 && t.cursorY < len(t.lines) {
				if t.cursorX < len(t.lines[t.cursorY]) {
					t.lines[t.cursorY] = t.lines[t.cursorY][:t.cursorX]
					t.dirty[t.cursorY] = true
				}
			}
		} else if p1 == 2 { // Clear entire line
			if t.cursorY >= 0 && t.cursorY < len(t.lines) {
				t.lines[t.cursorY] = []Cell{}
				t.dirty[t.cursorY] = true
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
		// Scroll
		diff := t.cursorY - (t.maxLines - 1)
		copy(t.lines, t.lines[diff:])
		for j := t.maxLines - diff; j < t.maxLines; j++ {
			t.lines[j] = []Cell{}
		}
		t.cursorY = t.maxLines - 1
		// When we scroll, every line effectively changes its content/index
		for j := 0; j < t.maxLines; j++ {
			t.dirty[j] = true
		}
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
	t.dirty[t.cursorY] = true
	t.cursorX++
}

func (t *Terminal) GetDeltaHTML() map[int]string {
	t.mu.Lock()
	defer t.mu.Unlock()

	delta := make(map[int]string)
	for idx, isDirty := range t.dirty {
		if isDirty {
			delta[idx] = t.renderLine(idx)
			delete(t.dirty, idx)
		}
	}
	return delta
}

func (t *Terminal) renderLine(idx int) string {
	var buf bytes.Buffer
	var activeStyle []byte
	for _, cell := range t.lines[idx] {
		if !bytes.Equal(cell.Style, activeStyle) {
			buf.Write(cell.Style)
			activeStyle = cell.Style
		}
		if cell.Char == 0 {
			buf.WriteByte(' ')
		} else {
			buf.WriteByte(cell.Char)
		}
	}
	// Always append reset to ensure line doesn't bleed into others in terminal-to-html
	buf.Write(chars.ANSI_Reset)
	return fmt.Sprintf(`<div data-line="%d">%s</div>`, idx, ansi.Render(buf.Bytes()))
}

func (t *Terminal) RenderHTML() string {
	t.mu.Lock()
	defer t.mu.Unlock()

	var buf bytes.Buffer
	for i := 0; i < t.maxLines; i++ {
		buf.WriteString(t.renderLine(i))
	}
	return buf.String()
}

func (t *Terminal) Clear() {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.resetBuffer()
}
