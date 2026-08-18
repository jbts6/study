package main

import "fmt"

func countByStatus(statuses []string) map[string]int {
	counts := make(map[string]int)
	for _, status := range statuses {
		if status == "" {
			continue
		}
		counts[status]++
	}
	return counts
}

func main() {
	fmt.Println(countByStatus([]string{"ready", "done", "done"}))
}
