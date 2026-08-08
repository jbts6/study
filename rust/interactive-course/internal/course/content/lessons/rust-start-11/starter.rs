#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Task {
    pub id: usize,
    pub title: String,
    pub done: bool,
}

#[derive(Debug, PartialEq, Eq)]
pub enum TaskError {
    EmptyTitle,
    MissingTask,
}

pub struct TaskBook {
    tasks: Vec<Task>,
    next_id: usize,
}

impl TaskBook {
    pub fn new() -> Self {
        todo!("创建空任务簿")
    }

    pub fn add(&mut self, _title: &str) -> Result<usize, TaskError> {
        todo!("新增任务")
    }

    pub fn complete(&mut self, _id: usize) -> Result<(), TaskError> {
        todo!("完成任务")
    }

    pub fn pending_titles(&self) -> Vec<&str> {
        Vec::new()
    }

    pub fn len(&self) -> usize {
        self.tasks.len()
    }
}
