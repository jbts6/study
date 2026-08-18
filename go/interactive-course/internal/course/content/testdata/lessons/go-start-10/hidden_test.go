package main

import "testing"

func TestNormalizeConfig(t *testing.T) {
	defaults := normalizeConfig(Config{})
	if defaults.Host != "127.0.0.1" || defaults.Port != 8080 {
		t.Fatalf("defaults = %#v", defaults)
	}
	explicit := normalizeConfig(Config{Host: "localhost", Port: 9090})
	if explicit.Host != "localhost" || explicit.Port != 9090 {
		t.Fatalf("explicit = %#v", explicit)
	}
}
