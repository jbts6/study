package main

import (
	"encoding/base64"
	"io"
	"os"
	"testing"
)

func TestFormatProfileUsesStringAndIntValues(t *testing.T) {
	if got := formatProfile("Ada", 37); got != "Name: Ada, Age: 37" {
		t.Fatalf("formatProfile(Ada, 37) = %q", got)
	}
}

func TestFormatProfileHandlesZeroValues(t *testing.T) {
	if got := formatProfile("", 0); got != "Name: Guest, Age: 0" {
		t.Fatalf("formatProfile(empty, 0) = %q", got)
	}
}

func TestMainPrintsProfileExample(t *testing.T) {
	output := captureProgramOutput(t, main)
	reportProgramOutput(t, output)
	if output != "Name: Ada, Age: 37\n" {
		t.Fatalf("main output = %q, want %q", output, "Name: Ada, Age: 37\n")
	}
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

func reportProgramOutput(t *testing.T, output string) {
	t.Helper()
	t.Log("GO_COURSE_STDOUT:" + base64.StdEncoding.EncodeToString([]byte(output)))
}
