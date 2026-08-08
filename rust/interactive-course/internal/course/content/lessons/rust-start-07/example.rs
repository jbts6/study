pub trait Summary {
    fn summary(&self) -> String;
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TaskSummary {
    pub title: String,
    pub done: bool,
}

impl Summary for TaskSummary {
    fn summary(&self) -> String {
        let status = if self.done { "done" } else { "pending" };
        format!("{} ({status})", self.title)
    }
}

pub fn pending_titles<'a>(tasks: &'a [TaskSummary]) -> impl Iterator<Item = &'a str> {
    tasks.iter().filter(|task| !task.done).map(|task| task.title.as_str())
}
