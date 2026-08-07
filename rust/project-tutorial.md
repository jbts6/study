

这是课程的综合项目，不是只读的架构示意。你将从零实现一个命令行任务管理器，先完成不依赖第三方库的同步版本，再选择性增加文件保存和 Tokio 异步事件流。

## 最终结果

程序支持：

- add 标题：新增任务；
- list：列出任务；
- done id：完成任务；
- remove id：删除任务；
- quit：退出；
- 错误输入返回明确的业务错误；
- 业务规则可以脱离终端单独测试；
- 可选：保存和加载本地文件；
- 可选：把命令交给 Tokio worker 处理。

项目重点不是命令行外观，而是练习 Rust 的所有权、enum、Result、模块、测试、线程和异步边界。

## 先定范围

第一版只做内存任务，不加 serde、clap 或数据库依赖。这样每个类型和错误都由你自己设计，编译器反馈不会被框架配置掩盖。完成同步版并写完测试后，再决定是否需要依赖。

推荐项目目录：

```text
task-board/
├── Cargo.toml
├── src/
│   ├── main.rs
│   ├── command.rs
│   ├── error.rs
│   └── task.rs
├── tests/
│   └── task_book.rs
└── notes/
    └── decisions.md
```

# 第 0 步：创建项目和验收基线

执行：

```bash
cargo new task-board
cd task-board
cargo check
cargo test
cargo fmt
```

在 notes/decisions.md 写下三项决定：

1. 第一版任务只保存 id、title、done。
2. TaskBook 拥有任务集合。
3. 终端输入只在 main 中出现，业务模块不读取 stdin。

每天结束运行：

```bash
cargo fmt --check
cargo check
cargo test
```

如果这三条命令不能通过，不进入下一步。先保留编译器输出，再处理一个最小错误。

# 第 1 步：设计领域类型

## 1.1 Task

在 src/task.rs 中先写数据，不急着写所有功能：

文件顶部先导入错误类型：

```rust
use crate::error::TaskError;
```

```rust
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Task {
    pub id: u32,
    pub title: String,
    pub done: bool,
}

impl Task {
    pub fn new(id: u32, title: String) -> Result<Self, TaskError> {
        let title = title.trim().to_owned();
        if title.is_empty() {
            return Err(TaskError::EmptyTitle);
        }

        Ok(Self {
            id,
            title,
            done: false,
        })
    }

    pub fn finish(&mut self) {
        self.done = true;
    }
}
```

这里让 Task::new 拥有传入的 String，因为任务需要长期保存标题；但调用方仍然可以把 &str 转成 String 后传入。不要在 new 内部保存一个局部字符串的引用。

## 1.2 TaskError

在 src/error.rs 中定义业务错误：

```rust
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TaskError {
    EmptyTitle,
    MissingTask(u32),
    InvalidCommand(String),
    Storage(String),
}
```

第一版只会用前三个变体。Storage 先保留给后面的文件扩展，真正使用时再补 I/O 错误转换。

## 1.3 TaskBook

TaskBook 是状态的唯一拥有者：

```rust
use crate::error::TaskError;
use crate::task::Task;

#[derive(Debug, PartialEq, Eq)]
pub struct TaskBook {
    tasks: Vec<Task>,
    next_id: u32,
}

impl TaskBook {
    pub fn new() -> Self {
        Self {
            tasks: Vec::new(),
            next_id: 1,
        }
    }

    pub fn add(&mut self, title: String) -> Result<&Task, TaskError> {
        let task = Task::new(self.next_id, title)?;
        self.next_id += 1;
        self.tasks.push(task);
        Ok(self.tasks.last().expect("刚刚插入的任务必须存在"))
    }
}
```

这里的 expect 只用于内部不变量：push 成功后 last 必然存在。用户输入的失败不能用 expect 处理，应该在 Task::new 中返回错误。

## 1.4 完成、删除和查询

继续给 TaskBook 增加方法：

```rust
impl TaskBook {
    pub fn all(&self) -> &[Task] {
        &self.tasks
    }

    pub fn find(&self, id: u32) -> Option<&Task> {
        self.tasks.iter().find(|task| task.id == id)
    }

    pub fn done(&mut self, id: u32) -> Result<&Task, TaskError> {
        let task = self
            .tasks
            .iter_mut()
            .find(|task| task.id == id)
            .ok_or(TaskError::MissingTask(id))?;

        task.finish();
        Ok(task)
    }

    pub fn remove(&mut self, id: u32) -> Result<Task, TaskError> {
        let index = self
            .tasks
            .iter()
            .position(|task| task.id == id)
            .ok_or(TaskError::MissingTask(id))?;

        Ok(self.tasks.remove(index))
    }
}
```

练习重点：

- all 返回切片，调用方只能借用读取；
- done 使用 iter_mut，因为它要修改任务；
- remove 用 remove 把 Task 的所有权交给调用方；
- ok_or 把 Option 转成带原因的 Result。

## 第 1 步检查

先在 task.rs 末尾加测试：

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn adds_trimmed_task() {
        let mut book = TaskBook::new();
        let task = book.add(String::from("  学 Rust  ")).unwrap();

        assert_eq!(task.title, "学 Rust");
        assert_eq!(task.id, 1);
        assert!(!task.done);
    }

    #[test]
    fn rejects_empty_title() {
        let mut book = TaskBook::new();
        assert_eq!(
            book.add(String::from("   ")),
            Err(TaskError::EmptyTitle)
        );
    }

    #[test]
    fn completes_and_removes_task() {
        let mut book = TaskBook::new();
        book.add(String::from("写测试")).unwrap();

        assert!(book.done(1).unwrap().done);
        assert_eq!(book.remove(1).unwrap().title, "写测试");
        assert!(book.all().is_empty());
    }

    #[test]
    fn reports_missing_task() {
        let mut book = TaskBook::new();
        assert_eq!(book.done(99), Err(TaskError::MissingTask(99)));
    }
}
```

运行：

```bash
cargo fmt
cargo test task
```

完成标准：

- [ ] 空标题失败。
- [ ] id 从 1 开始递增。
- [ ] 完成会修改 done。
- [ ] 删除会把 Task 所有权返回。
- [ ] 不存在 id 返回 MissingTask。

# 第 2 步：模块和公开接口

src/main.rs 先只声明模块：

```rust
mod command;
mod error;
mod task;

use command::Command;
use task::TaskBook;

fn main() {
    let _book = TaskBook::new();
    let _command = Command::List;
    println!("Task Board 已启动");
}
```

模块可见性规则：

- 文件内的函数默认私有；
- 其他模块要使用的类型和方法加 pub；
- TaskBook 的 tasks 字段不必公开，避免 main 直接绕过业务规则；
- error.rs 中的错误类型需要公开，因为 command 和 task 都要返回它。

如果出现 unresolved import，先检查 main.rs 是否声明了 mod，再检查类型和方法是否加 pub。

# 第 3 步：解析命令

## 3.1 定义 Command

src/command.rs：

```rust
use crate::error::TaskError;

#[derive(Debug, PartialEq, Eq)]
pub enum Command {
    Add(String),
    List,
    Done(u32),
    Remove(u32),
    Quit,
}

impl Command {
    pub fn parse(input: &str) -> Result<Self, TaskError> {
        let mut parts = input.split_whitespace();
        let name = parts.next().unwrap_or("");

        match name {
            "add" => {
                let title = parts.collect::<Vec<_>>().join(" ");
                if title.is_empty() {
                    Err(TaskError::EmptyTitle)
                } else {
                    Ok(Self::Add(title))
                }
            }
            "list" => Ok(Self::List),
            "done" => Ok(Self::Done(parse_id(parts.next())?)),
            "remove" => Ok(Self::Remove(parse_id(parts.next())?)),
            "quit" | "exit" => Ok(Self::Quit),
            _ => Err(TaskError::InvalidCommand(input.to_owned())),
        }
    }
}

fn parse_id(value: Option<&str>) -> Result<u32, TaskError> {
    value
        .ok_or_else(|| TaskError::InvalidCommand(String::from("缺少 id")))?
        .parse()
        .map_err(|_| TaskError::InvalidCommand(String::from("id 必须是数字")))
}
```

这里的 parse 只负责把文本变成类型，不负责修改 TaskBook。这样测试不需要启动终端。

## 3.2 解析测试

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_add_with_spaces() {
        assert_eq!(
            Command::parse("add 学 Rust"),
            Ok(Command::Add(String::from("学 Rust")))
        );
    }

    #[test]
    fn parses_numeric_commands() {
        assert_eq!(Command::parse("done 3"), Ok(Command::Done(3)));
        assert_eq!(Command::parse("remove 4"), Ok(Command::Remove(4)));
    }

    #[test]
    fn rejects_bad_input() {
        assert!(Command::parse("done abc").is_err());
        assert!(Command::parse("unknown").is_err());
    }
}
```

## 第 3 步检查

```bash
cargo fmt
cargo test command
cargo clippy -- -D warnings
```

不要在 parse 中调用 TaskBook。解析器只回答“这是什么命令”，业务层再回答“这个命令能否执行”。

# 第 4 步：执行命令和终端边界

在 task.rs 增加一个只负责展示的函数：

```rust
impl TaskBook {
    pub fn render(&self) -> String {
        if self.tasks.is_empty() {
            return String::from("暂无任务");
        }

        self.tasks
            .iter()
            .map(|task| {
                let mark = if task.done { "x" } else { " " };
                format!("[{mark}] {} {}", task.id, task.title)
            })
            .collect::<Vec<_>>()
            .join("\n")
    }
}
```

main.rs 负责读取输入和控制循环：

```rust
use std::io::{self, Write};

fn main() {
    let mut book = TaskBook::new();

    loop {
        print!("task> ");
        io::stdout().flush().expect("终端输出应可用");

        let mut input = String::new();
        if io::stdin().read_line(&mut input).is_err() {
            eprintln!("读取输入失败");
            break;
        }

        match Command::parse(&input) {
            Ok(Command::Add(title)) => match book.add(title) {
                Ok(task) => println!("已添加 {}：{}", task.id, task.title),
                Err(error) => eprintln!("添加失败：{error:?}"),
            },
            Ok(Command::List) => println!("{}", book.render()),
            Ok(Command::Done(id)) => match book.done(id) {
                Ok(task) => println!("已完成：{}", task.title),
                Err(error) => eprintln!("操作失败：{error:?}"),
            },
            Ok(Command::Remove(id)) => match book.remove(id) {
                Ok(task) => println!("已删除：{}", task.title),
                Err(error) => eprintln!("操作失败：{error:?}"),
            },
            Ok(Command::Quit) => break,
            Err(error) => eprintln!("命令错误：{error:?}"),
        }
    }
}
```

这里的两个 expect 是进程边界上的固定不变量：终端输出失败时程序无法继续交互。用户输入、任务 id 和标题都没有使用 expect。

为了让错误更适合用户，把 error.rs 增加 Display：

```rust
use std::fmt;

impl fmt::Display for TaskError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::EmptyTitle => write!(formatter, "任务标题不能为空"),
            Self::MissingTask(id) => write!(formatter, "找不到任务 {id}"),
            Self::InvalidCommand(message) => write!(formatter, "命令错误：{message}"),
            Self::Storage(message) => write!(formatter, "存储错误：{message}"),
        }
    }
}
```

完成后把 eprintln 中的 {:?} 改成 {}。Debug 方便开发，Display 负责用户看到的文字。

# 第 5 步：集成测试

单元测试验证模块内部规则，tests/task_book.rs 验证公开行为：

```rust
use task_board::task::TaskBook;

#[test]
fn user_can_add_and_complete_task() {
    let mut book = TaskBook::new();

    let created = book.add(String::from("完成项目")).unwrap();
    assert_eq!(created.id, 1);

    let completed = book.done(1).unwrap();
    assert!(completed.done);
}
```

如果项目还是二进制包，先把共享模块移到 src/lib.rs：

```rust
pub mod command;
pub mod error;
pub mod task;
```

然后 src/main.rs 用同名包路径导入。Cargo 的包名来自 Cargo.toml 中的 name 字段。

集成测试还要覆盖：

```rust
#[test]
fn missing_id_is_a_business_error() {
    let mut book = TaskBook::new();
    let error = book.remove(404).unwrap_err();
    assert_eq!(error.to_string(), "找不到任务 404");
}
```

运行：

```bash
cargo test
cargo test -- --nocapture
```

完成标准：

- [ ] 单元测试覆盖模型和解析器。
- [ ] 集成测试只使用公开接口。
- [ ] 测试不读取 stdin、不依赖终端顺序。
- [ ] 失败路径的错误文字稳定。

# 第 6 步：文件持久化扩展

同步内存版通过后再加持久化。先不引入序列化库，使用一个简单的文本格式：

```text
id<TAB>done<TAB>title
```

标题中的换行和制表符需要拒绝，或者设计转义规则。学习项目先拒绝它们，避免把重点变成写序列化器。

## 6.1 保存

在 task.rs 中添加：

先补充文件读写所需的导入：

```rust
use std::fs;
use std::path::Path;
```

```rust
use std::fs;
use std::path::Path;

impl TaskBook {
    pub fn save(&self, path: impl AsRef<Path>) -> Result<(), TaskError> {
        let mut output = String::new();

        for task in &self.tasks {
            if task.title.contains('\n') || task.title.contains('\t') {
                return Err(TaskError::Storage(String::from(
                    "标题不能包含换行或制表符",
                )));
            }

            output.push_str(&format!(
                "{}\t{}\t{}\n",
                task.id, task.done, task.title
            ));
        }

        fs::write(path, output)
            .map_err(|error| TaskError::Storage(error.to_string()))
    }
}
```

## 6.2 加载

加载时不要直接替换当前状态，先构造临时 TaskBook，全部解析成功后再返回：

```rust
impl TaskBook {
    pub fn load(path: impl AsRef<Path>) -> Result<Self, TaskError> {
        let text = fs::read_to_string(path)
            .map_err(|error| TaskError::Storage(error.to_string()))?;
        let mut book = Self::new();

        for line in text.lines() {
            let mut fields = line.splitn(3, '\t');
            let id = fields
                .next()
                .ok_or_else(|| TaskError::Storage(String::from("缺少 id")))?
                .parse::<u32>()
                .map_err(|_| TaskError::Storage(String::from("id 无效")))?;
            let done = fields
                .next()
                .ok_or_else(|| TaskError::Storage(String::from("缺少完成状态")))?
                .parse::<bool>()
                .map_err(|_| TaskError::Storage(String::from("完成状态无效")))?;
            let title = fields
                .next()
                .ok_or_else(|| TaskError::Storage(String::from("缺少标题")))?
                .to_owned();

            book.tasks.push(Task { id, title, done });
            book.next_id = book.next_id.max(id + 1);
        }

        Ok(book)
    }
}
```

需要注意 id 溢出。如果要把这个项目用于长期保存，应增加重复 id 和最大 id 的校验；学习项目可以把它作为额外练习。

## 6.3 持久化测试

```rust
#[test]
fn saves_and_loads_tasks() {
    let path = std::env::temp_dir().join("task-board-test.txt");
    let mut original = TaskBook::new();
    original.add(String::from("保存我")).unwrap();
    original.done(1).unwrap();

    original.save(&path).unwrap();
    let loaded = TaskBook::load(&path).unwrap();

    assert_eq!(loaded.all(), original.all());
    let _ = std::fs::remove_file(path);
}
```

测试失败时检查临时文件是否残留，不要把测试路径写死到项目目录。

# 第 7 步：Tokio 异步扩展

只有同步版测试稳定后才进入本节。异步版本的目标是练习事件处理，不是把所有方法改成 async。

Cargo.toml 增加：

```toml
[dependencies]
tokio = { version = "1", features = ["macros", "rt-multi-thread", "sync"] }
```

设计原则：

- 一个 worker 拥有 TaskBook；
- 主任务只发送 Command；
- worker 返回执行结果；
- Stop 关闭循环；
- 业务类型仍然使用同步的 TaskBook 方法。

消息类型：

```rust
use tokio::sync::oneshot;

pub enum WorkerMessage {
    Execute(Command, oneshot::Sender<Result<String, TaskError>>),
    Stop,
}
```

worker：

```rust
async fn run_worker(
    mut book: TaskBook,
    mut receiver: tokio::sync::mpsc::Receiver<WorkerMessage>,
) {
    while let Some(message) = receiver.recv().await {
        match message {
            WorkerMessage::Execute(command, response) => {
                let result = execute_command(&mut book, command);
                let _ = response.send(result);
            }
            WorkerMessage::Stop => break,
        }
    }
}
```

这里的 execute_command 可以是同步函数，因为它只是内存操作。不要为了“异步”给纯计算和纯内存逻辑加无意义的 await。

## 7.1 异步测试

```rust
#[tokio::test]
async fn worker_returns_command_result() {
    let (sender, receiver) = tokio::sync::mpsc::channel(4);
    let worker = tokio::spawn(run_worker(TaskBook::new(), receiver));
    let (response_sender, response_receiver) = oneshot::channel();

    sender
        .send(WorkerMessage::Execute(
            Command::Add(String::from("异步任务")),
            response_sender,
        ))
        .await
        .unwrap();

    assert!(response_receiver.await.unwrap().is_ok());
    sender.send(WorkerMessage::Stop).await.unwrap();
    worker.await.unwrap();
}
```

异步扩展的验收：

- [ ] worker 是 TaskBook 的唯一拥有者。
- [ ] 主任务不直接修改 worker 内的状态。
- [ ] Stop 后 worker 能结束。
- [ ] response channel 关闭时没有 panic。
- [ ] 同步业务测试仍然全部通过。

# 第 8 步：重构与代码审查

完成功能后做一次反向审查：

## 所有权审查

- TaskBook 是否唯一拥有任务集合？
- 返回 Task 的方法是否真的需要转移所有权？
- 是否存在为了过编译而添加的 clone？
- 公开切片是否让调用方意外依赖内部结构？

## 错误审查

- 用户输入是否都通过 Result 返回？
- 文件错误是否保留原始信息？
- worker 停止和响应 channel 关闭是否可区分？
- main 是否只负责展示错误？

## 测试审查

- 空列表、空标题、未知命令、不存在 id 是否覆盖？
- 持久化文件损坏时是否失败？
- 测试是否依赖真实用户目录？
- 异步测试是否有明确的退出和等待？

## 工程命令

```bash
cargo fmt --check
cargo check
cargo clippy -- -D warnings
cargo test
```

# 最终验收

## 功能

- [ ] add、list、done、remove、quit 均可使用。
- [ ] 空标题、未知命令、无效 id、有不存在任务均有明确错误。
- [ ] 任务 id 稳定递增。
- [ ] list 的输出顺序稳定。
- [ ] 持久化可选功能通过保存和加载测试。

## Rust 能力

- [ ] TaskBook 通过所有权拥有任务。
- [ ] 查询使用借用，修改使用可变借用。
- [ ] enum 表达命令和错误。
- [ ] Result 传播失败，不用 panic 处理用户输入。
- [ ] 至少一个线程或 Tokio worker 有明确停止路径。

## 交付物

完成后应留下：

```text
src/
├── main.rs
├── command.rs
├── error.rs
└── task.rs

tests/
└── task_book.rs

notes/
└── decisions.md
```

在 decisions.md 中写下：

1. 为什么 TaskBook 拥有 Vec<Task>；
2. 为什么解析和执行分开；
3. 为什么第一版先不用依赖；
4. 为什么持久化或异步扩展被放在同步版之后；
5. 一次真实编译错误以及你的修复原因。

这个项目完成后，再回到 [course.md](course.md) 的最终验收表，并使用 [resources.md](resources.md) 选择下一项针对性练习，不要继续堆无关链接。
