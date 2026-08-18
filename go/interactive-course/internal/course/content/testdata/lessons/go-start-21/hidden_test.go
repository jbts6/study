package main

import (
	"reflect"
	"testing"
)

func TestCountByStatus(t *testing.T) {
	want := map[string]int{"ready": 1, "done": 2}
	got := countByStatus([]string{"ready", "", "done", "done"})
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("countByStatus() = %#v, want %#v", got, want)
	}
}
