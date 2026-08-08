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
        todo!("返回任务摘要")
    }
}

pub fn pending_titles<'a>(_tasks: &'a [TaskSummary]) -> impl Iterator<Item = &'a str> {
    std::iter::empty()
}
