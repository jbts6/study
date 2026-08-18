package main

import "testing"

func TestMemoryTaskStore(t *testing.T) {
	store := NewMemoryTaskStore()
	want := Task{Title: "learn repositories", Done: true}
	if err := store.Save(want); err != nil {
		t.Fatal(err)
	}
	got, ok := store.Find(want.Title)
	if !ok || got != want {
		t.Fatalf("Find() = %#v, %v; want %#v, true", got, ok, want)
	}
}

func TestMemoryTaskStoreRejectsEmptyTitle(t *testing.T) {
	if err := NewMemoryTaskStore().Save(Task{}); err == nil {
		t.Fatal("Save(empty) error = nil")
	}
}
