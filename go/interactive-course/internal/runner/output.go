package runner

import (
	"bytes"
	"sync"
)

type outputBudget struct {
	limit     int
	used      int
	truncated bool
	mu        sync.Mutex
}

type limitedWriter struct {
	budget *outputBudget
	buffer bytes.Buffer
}

func newLimitedWriter(limit int) *limitedWriter {
	if limit <= 0 {
		limit = DefaultMaxOutput
	}
	return &limitedWriter{budget: &outputBudget{limit: limit}}
}

func newSharedLimitedWriters(limit int) (*limitedWriter, *limitedWriter) {
	if limit <= 0 {
		limit = DefaultMaxOutput
	}
	budget := &outputBudget{limit: limit}
	return &limitedWriter{budget: budget}, &limitedWriter{budget: budget}
}

func (w *limitedWriter) Write(data []byte) (int, error) {
	w.budget.mu.Lock()
	defer w.budget.mu.Unlock()

	remaining := w.budget.limit - w.budget.used
	if remaining <= 0 {
		w.budget.truncated = true
		return len(data), nil
	}

	writeLength := len(data)
	if writeLength > remaining {
		writeLength = remaining
	}
	_, _ = w.buffer.Write(data[:writeLength])
	w.budget.used += writeLength
	if writeLength < len(data) {
		w.budget.truncated = true
	}
	return len(data), nil
}

func (w *limitedWriter) String() string {
	w.budget.mu.Lock()
	defer w.budget.mu.Unlock()
	return w.buffer.String()
}

func (w *limitedWriter) Truncated() bool {
	w.budget.mu.Lock()
	defer w.budget.mu.Unlock()
	return w.budget.truncated
}
