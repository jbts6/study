package main

import (
	"encoding/json"
	"fmt"
)

type Task struct {
	Title string
	Done  bool
}

func encodeTask(task Task) (string, error) {
	return "", nil
}

func decodeTask(input string) (Task, error) {
	var task Task
	err := json.Unmarshal([]byte(input), &task)
	return task, err
}

func main() {
	encoded, _ := encodeTask(Task{Title: "learn JSON", Done: true})
	fmt.Println(encoded)
}
