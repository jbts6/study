use rust_lesson::{pending_titles, Summary, TaskSummary};

#[test]
fn implements_summary() {
    let task = TaskSummary { title: "write".into(), done: false };
    assert_eq!(task.summary(), "write (pending)");
}

#[test]
fn filters_pending_titles() {
    let tasks = vec![
        TaskSummary { title: "read".into(), done: true },
        TaskSummary { title: "write".into(), done: false },
    ];
    assert_eq!(pending_titles(&tasks).collect::<Vec<_>>(), vec!["write"]);
}
