package main

import "fmt"

func firstMessage(primary, fallback <-chan string) string {
	select {
	case message := <-primary:
		return message
	case message := <-fallback:
		return message
	}
}

func main() {
	primary := make(chan string, 1)
	fallback := make(chan string, 1)
	fallback <- "backup"
	fmt.Println(firstMessage(primary, fallback))
}
