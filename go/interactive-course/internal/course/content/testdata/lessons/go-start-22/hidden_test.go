package main

import (
	"reflect"
	"testing"
)

func TestAnalyzeLogs(t *testing.T) {
	lines := []string{"api|INFO", "api|ERROR", "web|WARN", "bad", "|ERROR", "api|DEBUG"}
	got := analyzeLogs(lines)
	wantServices := map[string]int{"api": 2, "web": 1}
	if got.Total != 3 || got.Errors != 1 || !reflect.DeepEqual(got.ByService, wantServices) {
		t.Fatalf("analyzeLogs() = %#v", got)
	}
}
