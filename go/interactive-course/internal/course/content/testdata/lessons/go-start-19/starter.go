package main

import "fmt"

type Task struct {
	Title string
	Done  bool
}

type MemoryTaskStore struct {
	tasks map[string]Task
}

func NewMemoryTaskStore() *MemoryTaskStore {
	return &MemoryTaskStore{}
}

func (store *MemoryTaskStore) Save(task Task) error {
	return nil
}

func (store *MemoryTaskStore) Find(title string) (Task, bool) {
	return Task{}, false
}

func main() {
	store := NewMemoryTaskStore()
	task, found := store.Find("learn repositories")
	fmt.Println(task, found)
}
