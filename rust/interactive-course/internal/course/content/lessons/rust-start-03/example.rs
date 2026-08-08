#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Task {
    pub title: String,
    pub done: bool,
}

impl Task {
    pub fn new(title: impl Into<String>) -> Self {
        Self {
            title: title.into(),
            done: false,
        }
    }
}

pub fn find_task<'a>(tasks: &'a [Task], title: &str) -> Option<&'a Task> {
    tasks.iter().find(|task| task.title == title)
}
