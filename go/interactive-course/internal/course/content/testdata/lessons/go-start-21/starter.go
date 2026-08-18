package main

import "fmt"

func countByStatus(statuses []string) map[string]int {
	return map[string]int{}
}

func main() {
	fmt.Println(countByStatus([]string{"ready", "done", "done"}))
}
