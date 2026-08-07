//go:build ignore

package main

import "fmt"

func classify(score int) string {
	if score >= 90 {
		return "excellent"
	}
	if score >= 60 {
		return "pass"
	}
	return "retry"
}

func main() {
	fmt.Println(classify(88))
}
