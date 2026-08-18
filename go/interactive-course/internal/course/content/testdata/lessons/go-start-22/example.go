package main

import (
	"fmt"
	"strings"
)

type LogSummary struct {
	Total     int
	Errors    int
	ByService map[string]int
}

func analyzeLogs(lines []string) LogSummary {
	summary := LogSummary{ByService: make(map[string]int)}
	for _, line := range lines {
		parts := strings.SplitN(line, "|", 2)
		if len(parts) != 2 || parts[0] == "" {
			continue
		}
		level := parts[1]
		if level != "INFO" && level != "WARN" && level != "ERROR" {
			continue
		}
		summary.Total++
		summary.ByService[parts[0]]++
		if level == "ERROR" {
			summary.Errors++
		}
	}
	return summary
}

func main() {
	fmt.Printf("%#v\n", analyzeLogs([]string{"api|INFO", "api|ERROR", "web|WARN"}))
}
