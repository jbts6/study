package main

import "fmt"

type LogSummary struct {
	Total     int
	Errors    int
	ByService map[string]int
}

func analyzeLogs(lines []string) LogSummary {
	return LogSummary{ByService: map[string]int{}}
}

func main() {
	fmt.Printf("%#v\n", analyzeLogs([]string{"api|INFO", "api|ERROR"}))
}
