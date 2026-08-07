//go:build ignore

package main

import "fmt"

func formatProfile(name string, age int) string {
	if name == "" {
		name = "Guest"
	}
	return fmt.Sprintf("Name: %s, Age: %d", name, age)
}

func main() {
	fmt.Println(formatProfile("Ada", 37))
}
