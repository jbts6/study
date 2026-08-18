package main

import "testing"

func TestDescribeUser(t *testing.T) {
	if got := describeUser(User{Name: "Ada", Age: 37}); got != "Ada (37)" {
		t.Fatalf("describeUser() = %q, want %q", got, "Ada (37)")
	}
}
