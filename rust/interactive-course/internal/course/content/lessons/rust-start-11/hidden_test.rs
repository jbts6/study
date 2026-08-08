use rust_lesson::{TaskBook, TaskError};

#[test]
fn adds_and_lists_pending_tasks() {
    let mut book = TaskBook::new();
    assert_eq!(book.add("learn Rust"), Ok(1));
    assert_eq!(book.add("write tests"), Ok(2));
    assert_eq!(book.pending_titles(), vec!["learn Rust", "write tests"]);
    assert_eq!(book.len(), 2);
}

#[test]
fn completes_a_task_and_reports_errors() {
    let mut book = TaskBook::new();
    assert_eq!(book.add("learn Rust"), Ok(1));
    assert_eq!(book.complete(1), Ok(()));
    assert_eq!(book.pending_titles(), Vec::<&str>::new());
    assert_eq!(book.complete(9), Err(TaskError::MissingTask));
    assert_eq!(book.add("  "), Err(TaskError::EmptyTitle));
}
