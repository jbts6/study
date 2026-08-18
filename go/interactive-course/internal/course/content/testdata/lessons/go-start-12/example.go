package main

import "fmt"

func collectMessages(messages []string) []string {
	stream := make(chan string, len(messages))
	for _, message := range messages {
		stream <- message
	}
	close(stream)
	result := make([]string, 0, len(messages))
	for message := range stream {
		result = append(result, message)
	}
	return result
}

func main() {
	fmt.Println(collectMessages([]string{"ready", "run"}))
}
