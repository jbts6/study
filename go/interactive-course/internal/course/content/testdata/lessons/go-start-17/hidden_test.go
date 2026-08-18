package main

import "testing"

func TestTaskJSONRoundTrip(t *testing.T) {
	want := Task{Title: "learn JSON", Done: true}
	encoded, err := encodeTask(want)
	if err != nil {
		t.Fatal(err)
	}
	if encoded != `{"title":"learn JSON","done":true}` {
		t.Fatalf("encodeTask() = %s, want stable title/done field names", encoded)
	}
	got, err := decodeTask(encoded)
	if err != nil || got != want {
		t.Fatalf("round trip = %#v, %v; want %#v", got, err, want)
	}
}

func TestDecodeTaskInvalid(t *testing.T) {
	if _, err := decodeTask("{"); err == nil {
		t.Fatal("decodeTask(invalid) error = nil")
	}
}
