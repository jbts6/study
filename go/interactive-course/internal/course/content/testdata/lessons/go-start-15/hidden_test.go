package main

import (
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

func TestReadLines(t *testing.T) {
	path := filepath.Join(t.TempDir(), "notes.txt")
	if err := os.WriteFile(path, []byte("one\ntwo\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	want := []string{"one", "two"}
	got, err := readLines(path)
	if err != nil || !reflect.DeepEqual(got, want) {
		t.Fatalf("readLines() = %#v, %v; want %#v", got, err, want)
	}
}

func TestReadLinesMissingFile(t *testing.T) {
	if _, err := readLines(filepath.Join(t.TempDir(), "missing")); err == nil {
		t.Fatal("readLines(missing) error = nil")
	}
}
