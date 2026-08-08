#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Task {
    pub title: String,
    pub done: bool,
}

impl Task {
    pub fn new(_title: impl Into<String>) -> Self {
        todo!("创建未完成任务")
    }
}

pub fn find_task<'a>(_tasks: &'a [Task], _title: &str) -> Option<&'a Task> {
    todo!("查询任务")
}
