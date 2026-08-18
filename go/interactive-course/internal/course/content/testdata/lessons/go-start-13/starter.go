package main

import "fmt"

func firstMessage(primary, fallback <-chan string) string {
	// TODO: 用 select 等待两个 channel。
	return ""
}

func main() {
	primary := make(chan string, 1)
	fallback := make(chan string, 1)
	fallback <- "backup"
	fmt.Println(firstMessage(primary, fallback))
}
