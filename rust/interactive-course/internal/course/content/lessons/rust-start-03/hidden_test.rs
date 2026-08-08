use rust_lesson::{find_task, Task};

#[test]
fn builds_new_task() {
    assert_eq!(Task::new("learn Rust"), Task { title: "learn Rust".into(), done: false });
}

#[test]
fn returns_none_for_missing_task() {
    let tasks = vec![Task::new("read")];
    assert_eq!(find_task(&tasks, "write"), None);
    assert_eq!(find_task(&tasks, "read").map(|task| task.title.as_str()), Some("read"));
}
