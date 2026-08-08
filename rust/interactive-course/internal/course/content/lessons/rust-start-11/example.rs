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
        Self { tasks: Vec::new(), next_id: 1 }
    }

    pub fn add(&mut self, title: &str) -> Result<usize, TaskError> {
        let title = title.trim();
        if title.is_empty() {
            return Err(TaskError::EmptyTitle);
        }
        let id = self.next_id;
        self.next_id += 1;
        self.tasks.push(Task { id, title: title.to_owned(), done: false });
        Ok(id)
    }

    pub fn complete(&mut self, id: usize) -> Result<(), TaskError> {
        let task = self.tasks.iter_mut().find(|task| task.id == id).ok_or(TaskError::MissingTask)?;
        task.done = true;
        Ok(())
    }

    pub fn pending_titles(&self) -> Vec<&str> {
        self.tasks.iter().filter(|task| !task.done).map(|task| task.title.as_str()).collect()
    }

    pub fn len(&self) -> usize {
        self.tasks.len()
    }
}
