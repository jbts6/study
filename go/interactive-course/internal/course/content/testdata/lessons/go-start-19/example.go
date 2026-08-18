package main

import (
	"errors"
	"fmt"
	"strings"
)

type Task struct {
	Title string
	Done  bool
}

type TaskStore interface {
	Save(Task) error
	Find(string) (Task, bool)
}

type MemoryTaskStore struct {
	tasks map[string]Task
}

func NewMemoryTaskStore() *MemoryTaskStore {
	return &MemoryTaskStore{tasks: make(map[string]Task)}
}

func (store *MemoryTaskStore) Save(task Task) error {
	if strings.TrimSpace(task.Title) == "" {
		return errors.New("title is required")
	}
	store.tasks[task.Title] = task
	return nil
}

func (store *MemoryTaskStore) Find(title string) (Task, bool) {
	task, ok := store.tasks[title]
	return task, ok
}

func main() {
	store := NewMemoryTaskStore()
	_ = store.Save(Task{Title: "learn repositories"})
	task, found := store.Find("learn repositories")
	fmt.Println(task, found)
}
