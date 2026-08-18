package main

import (
	"reflect"
	"testing"
)

func TestCollectMessages(t *testing.T) {
	want := []string{"ready", "run"}
	if got := collectMessages(want); !reflect.DeepEqual(got, want) {
		t.Fatalf("collectMessages() = %#v, want %#v", got, want)
	}
}
