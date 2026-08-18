package main

import (
	"encoding/base64"
	"io"
	"os"
	"testing"
)

func TestHelloGoOutput(t *testing.T) {
	output := captureProgramOutput(t, main)
	reportProgramOutput(t, output)
	if output != "Hello, Go!\n" {
		t.Fatalf("main output = %q, want %q", output, "Hello, Go!\n")
	}
}

func reportProgramOutput(t *testing.T, output string) {
	t.Helper()
	t.Log("GO_COURSE_STDOUT:" + base64.StdEncoding.EncodeToString([]byte(output)))
}

func captureProgramOutput(t *testing.T, run func()) string {
	t.Helper()

	original := os.Stdout
	reader, writer, err := os.Pipe()
	if err != nil {
		t.Fatalf("create output pipe: %v", err)
	}
	os.Stdout = writer
	run()
	if err := writer.Close(); err != nil {
		t.Fatalf("close output pipe: %v", err)
	}
	os.Stdout = original

	output, err := io.ReadAll(reader)
	if err != nil {
		t.Fatalf("read captured output: %v", err)
	}
	_ = reader.Close()
	return string(output)
}
