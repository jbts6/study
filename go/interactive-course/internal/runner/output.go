package runner

import "bytes"

type limitedWriter struct {
	limit     int
	buffer    bytes.Buffer
	truncated bool
}

func newLimitedWriter(limit int) *limitedWriter {
	if limit <= 0 {
		limit = DefaultMaxOutput
	}
	return &limitedWriter{limit: limit}
}

func (w *limitedWriter) Write(data []byte) (int, error) {
	remaining := w.limit - w.buffer.Len()
	if remaining <= 0 {
		w.truncated = true
		return len(data), nil
	}
	if len(data) > remaining {
		_, _ = w.buffer.Write(data[:remaining])
		w.truncated = true
		return len(data), nil
	}
	_, _ = w.buffer.Write(data)
	return len(data), nil
}

func (w *limitedWriter) String() string { return w.buffer.String() }

func (w *limitedWriter) Truncated() bool { return w.truncated }
