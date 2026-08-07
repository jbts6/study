# Rust 本地完整课程+

这份文件是本地学习的正文，不是 GitHub 链接目录。建议每次只学习一个章节：先读概念，再把示例敲进自己的 Cargo 项目，最后完成练习和检查点。外部仓库只在延伸阅读里出现，用来补充练习量和工程视角。

## 课程目标

完成后，你应该能够：

- 独立创建、运行、测试和组织一个 Rust Cargo 项目；
- 解释所有权、移动、借用、切片和生命周期，而不是只靠编译器试错；
- 用 Option 和 Result 表达缺失值与失败，而不是滥用空字符串或特殊数字；
- 使用 struct、enum、trait、泛型和迭代器组织可复用代码；
- 写出线程安全的共享状态代码，并理解 Arc、Mutex 和 channel 的职责；
- 读懂基础 Tokio 异步代码，知道何时应该把工作拆成任务；
- 从零完成一个带测试、错误处理和持久化边界的本地项目。

## 学习方式

每章按下面的循环完成：

1. 先不复制代码，自己预测类型、所有权和输出。
2. 手写示例，运行 cargo check 和 cargo test。
3. 故意改错一次，读编译器错误，再恢复。
4. 完成练习，把答案放进独立的 examples 或测试中。
5. 用自己的话写三句话复盘：数据放在哪里、谁拥有它、失败怎么返回。

推荐目录：

```text
rust-lab/
├── Cargo.toml
└── src/
    └── main.rs
```

开始项目：

```bash
cargo new rust-lab
cd rust-lab
cargo run
cargo check
cargo test
```

# 第 0 章：工具链与第一个 Cargo 项目

## 学习目标

- 区分 rustc、cargo、工具链和 Cargo 包。
- 会用 cargo new、cargo run、cargo check、cargo test。
- 能从编译器输出中定位文件、行号和错误原因。

## 核心讲解

Rust 源文件可以直接交给 rustc，但日常开发应以 Cargo 项目为单位。Cargo 负责依赖、编译、测试和发布配置。cargo check 只做快速类型检查，适合频繁运行；cargo run 会编译并执行；cargo test 会编译测试并执行测试。

Cargo.toml 是项目清单，src/main.rs 是二进制程序入口。初学时先用一个文件观察编译器反馈，等类型和模块边界稳定后再拆分。

```rust
fn main() {
    let language = "Rust";
    println!("正在学习 {language}");
}
```

变量默认不可变。mut 表示允许重新绑定同一个变量的值。

```rust
fn main() {
    let mut minutes = 25;
    minutes += 5;
    println!("本次学习 {minutes} 分钟");
}
```

## 动手练习

1. 创建 rust-lab 项目，把程序改成打印今天的学习主题。
2. 增加 sessions 变量，输出学习次数。
3. 依次运行 cargo check、cargo run、cargo test，记录三条命令的用途。
4. 在 main 中写一个类型错误，观察编译器给出的文件和行号，然后恢复。

## 常见报错与排查

- could not find Cargo.toml：当前目录不是 Cargo 项目根目录，先检查路径。
- cannot find function：函数名拼写或作用域不对，确认定义位置和调用名称。
- 修改后输出没有变化：确认运行的是当前目录的项目，而不是另一个同名项目。
- 依赖下载失败时先观察错误发生在网络、解析还是代码编译阶段。

## 完成检查

- [ ] 能从任意目录定位到项目根目录。
- [ ] 能解释 cargo check 和 cargo run 的区别。
- [ ] 能让一个故意的编译错误恢复为绿色构建。

# 第 1 章：变量、类型、控制流与函数

## 学习目标

- 认识 Rust 的显式类型、类型推导和表达式。
- 使用 if、match、loop、while、for。
- 写出有输入类型和返回类型的函数。

## 核心讲解

Rust 会推导局部变量类型，但不会把不同类型自动转换。if 是表达式，两个分支必须返回兼容类型；块的最后一行没有分号时就是该块的值。函数参数和返回值建议写清楚，能让代码意图更稳定。

```rust
fn classify(score: u32) -> &'static str {
    if score >= 90 {
        "优秀"
    } else if score >= 60 {
        "及格"
    } else {
        "继续练习"
    }
}

fn main() {
    println!("{}", classify(82));
}
```

match 要覆盖所有可能分支。它比一长串布尔条件更适合处理离散状态。

```rust
fn command_label(command: char) -> &'static str {
    match command {
        'a' => "添加",
        'l' => "列出",
        'q' => "退出",
        _ => "未知命令",
    }
}

fn main() {
    for command in ['a', 'l', 'q', 'x'] {
        println!("{command}: {}", command_label(command));
    }
}
```

循环也有返回值。break value 可以把计算结果带出循环。

```rust
fn first_even(numbers: &[i32]) -> Option<i32> {
    let mut index = 0;
    loop {
        if index == numbers.len() {
            break None;
        }
        if numbers[index] % 2 == 0 {
            break Some(numbers[index]);
        }
        index += 1;
    }
}

fn main() {
    println!("{:?}", first_even(&[3, 7, 8, 11]));
}
```

## 动手练习

1. 写 temperature_label 函数，区分寒冷、舒适和炎热。
2. 写一个函数，把 1 到 100 的偶数相加。
3. 用 match 处理 add、list、quit 三种命令。
4. 把一个返回空元组的函数改成返回计算结果，并说明每个分支的类型。

## 常见报错与排查

- mismatched types：某个分支返回了整数，另一个分支返回了字符串或空元组，检查分支最后一行和分号。
- non-exhaustive patterns：match 少了分支，补全所有枚举变体或添加兜底分支。
- expected i32, found usize：索引和长度通常是 usize，不要直接和有符号整数相加。
- unused variable：暂时不用的变量可以命名为下划线开头，但不要用它掩盖真正的逻辑遗漏。

## 完成检查

- [ ] 能说明语句和表达式的区别。
- [ ] 能不用 if 链写出一个完整 match。
- [ ] 能判断一个分支为什么推导成空元组。

# 第 2 章：字符串、向量与哈希表

## 学习目标

- 区分字符串字面量、str 切片和拥有所有权的 String。
- 使用 Vec 保存有序数据。
- 使用 HashMap 做键值查找。
- 理解 UTF-8 下不能按整数索引 String。

## 核心讲解

str 是一段字符串切片，通常借用已有文本；String 在堆上拥有可增长的 UTF-8 字节序列。需要拼接或保存输入时通常使用 String，只读参数优先使用 str 的借用。

```rust
fn greet(name: &str) -> String {
    format!("你好，{name}！")
}

fn main() {
    let name = String::from("小林");
    println!("{}", greet(&name));
}
```

Vec 的元素类型必须一致。push 修改向量，迭代器读取向量。

```rust
fn main() {
    let mut topics = vec!["所有权", "借用"];
    topics.push("错误处理");

    for (index, topic) in topics.iter().enumerate() {
        println!("{}. {topic}", index + 1);
    }
}
```

HashMap 的 entry API 适合“存在就更新，不存在就插入”的统计逻辑。

```rust
use std::collections::HashMap;

fn count_words(words: &[&str]) -> HashMap<String, usize> {
    let mut counts = HashMap::new();
    for word in words {
        *counts.entry((*word).to_owned()).or_insert(0) += 1;
    }
    counts
}

fn main() {
    let counts = count_words(&["rust", "ownership", "rust"]);
    println!("{counts:?}");
}
```

## 动手练习

1. 写 longest_word，从字符串切片中找到最长的单词。
2. 统计一段文本中每个单词出现次数，忽略空字符串。
3. 写一个待办事项列表，支持添加、删除最后一项和打印全部内容。
4. 解释为什么不能用 text[0] 取中文字符串的第一个字符，改用 chars().next()。

## 常见报错与排查

- cannot move out of：把拥有所有权的 String 传给了只需要读取的函数，参数改成借用或调用处传引用。
- cannot index into String：字符串按 UTF-8 字节存储，使用 chars 或 bytes，不要整数索引。
- borrowed value does not live long enough：返回了局部 String 的引用；如果调用者需要拥有结果，返回 String。
- 检查 HashMap 的键类型和查询值类型，必要时统一键类型或显式转换。

## 完成检查

- [ ] 能说明 String 和 str 的所有权关系。
- [ ] 能使用 Vec 和 HashMap 完成一次统计任务。
- [ ] 能根据错误信息判断是移动、借用还是 UTF-8 索引问题。

# 第 3 章：struct、enum 与 Option

## 学习目标

- 用 struct 表达有名字的字段。
- 用 impl 为数据类型添加方法。
- 用 enum 表达互斥状态。
- 用 Option 表达“可能没有值”。

## 核心讲解

struct 适合描述一个实体的多个属性；enum 适合描述一个值只能处于若干状态之一。把非法状态放进类型设计，后面的函数就不必到处猜测字符串含义。

```rust
struct Task {
    title: String,
    done: bool,
}

impl Task {
    fn new(title: impl Into<String>) -> Self {
        Self {
            title: title.into(),
            done: false,
        }
    }

    fn finish(&mut self) {
        self.done = true;
    }
}

fn main() {
    let mut task = Task::new("练习 struct");
    task.finish();
    println!("{} / {}", task.title, task.done);
}
```

枚举可以携带不同的数据。match 解构后，编译器会提醒你是否处理完整。

```rust
enum Input {
    Add(String),
    Remove(usize),
    Quit,
}

fn describe(input: Input) -> String {
    match input {
        Input::Add(title) => format!("添加：{title}"),
        Input::Remove(index) => format!("删除第 {index} 项"),
        Input::Quit => String::from("退出"),
    }
}

fn main() {
    println!("{}", describe(Input::Add(String::from("读 Rust"))));
}
```

Option 的两个变体是 Some(value) 和 None。不要用特殊数字或空字符串表示“没有找到”。

```rust
fn find_task<'a>(tasks: &'a [String], keyword: &str) -> Option<&'a String> {
    tasks.iter().find(|task| task.contains(keyword))
}

fn main() {
    let tasks = vec![String::from("读 Rust"), String::from("写练习")];
    match find_task(&tasks, "写") {
        Some(task) => println!("找到：{task}"),
        None => println!("没有找到"),
    }
}
```

## 动手练习

1. 给 Task 增加优先级 enum 和 display 方法。
2. 写 find_task 的可变版本，找到后将任务标记为完成。
3. 为命令定义 Add、List、Quit 三个变体。
4. 把一个返回 -1 表示失败的函数改成返回 Option。

## 常见报错与排查

- no field：字段名或字段所属类型错误，确认是否在正确的 impl 内访问。
- use of moved value：match 消耗了拥有值；只需要查看时使用引用匹配。
- cannot borrow as mutable：方法需要可变借用，调用变量必须声明为 mut。
- Option 不能直接当作里面的值使用，先用 match、if let 或 unwrap_or 明确处理 None。

## 完成检查

- [ ] 能把一个字符串协议改成 enum。
- [ ] 能写出不使用 unwrap 的 Option 分支。
- [ ] 能解释方法接收者 self、引用 self 和可变引用 self 的区别。

# 第 4 章：所有权、移动、Copy 与 Clone

## 学习目标

- 画出栈、堆和变量绑定之间的关系。
- 区分移动、复制和显式克隆。
- 能预测函数调用后哪些变量仍然可用。

## 核心讲解

Rust 中每个值有一个所有者。拥有堆数据的值离开作用域时自动清理。把 String 赋值给另一个变量通常是移动，旧绑定不能再使用；整数等简单类型实现 Copy，赋值会复制值。

```rust
fn take_title(title: String) {
    println!("处理：{title}");
}

fn main() {
    let title = String::from("所有权");
    take_title(title);
    // 移动后不能再次使用 title
}
```

如果确实需要两份独立的堆数据，显式调用 clone，并把它当成有成本的操作。

```rust
fn main() {
    let original = String::from("原始文本");
    let backup = original.clone();

    println!("{original}");
    println!("{backup}");
}
```

函数也可以通过返回值把所有权交回调用者。更常见的方式是借用，让函数读取数据但不拿走它。

```rust
fn add_suffix(mut text: String) -> String {
    text.push_str("：已完成");
    text
}

fn main() {
    let title = add_suffix(String::from("练习"));
    println!("{title}");
}
```

## 动手练习

1. 分别演示 i32 的复制、String 的移动和 String 的 clone。
2. 把一个接收 String 的函数改成借用读取版本。
3. 标记每个变量拥有的资源和离开作用域的时间。
4. 解释为什么 clone 能解决错误，但不一定是好设计。

## 常见报错与排查

- borrow of moved value：值已经被按值传入函数；改用借用、返回所有权或显式 clone。
- use of moved value：追踪最后一次移动发生的位置，不要只看报错行。
- doesn't implement Copy：String 不能隐式复制，必须借用或显式克隆。
- cannot move out of borrowed content：不能从引用中拿走所有权，改用引用或明确的复制操作。

## 完成检查

- [ ] 能从函数签名看出是否会转移所有权。
- [ ] 能解释 Copy 和 Clone 的区别。
- [ ] 能不依赖 clone 修复一次移动错误。

# 第 5 章：借用、切片与生命周期

## 学习目标

- 使用引用和可变引用读写借用数据。
- 使用切片表达连续区间。
- 理解生命周期标注是关系说明，不是延长变量寿命。
- 避免同时存在冲突的借用。

## 核心讲解

借用允许暂时使用别人的值，但不能在所有者销毁后继续使用。一个作用域里可以有多个不可变借用，或者一个可变借用，不能二者同时活跃。

```rust
fn append_topic(topics: &mut Vec<String>, topic: &str) {
    topics.push(topic.to_owned());
}

fn count_topics(topics: &[String]) -> usize {
    topics.len()
}

fn main() {
    let mut topics = vec![String::from("所有权")];
    append_topic(&mut topics, "借用");
    println!("共有 {} 个主题", count_topics(&topics));
}
```

切片是不拥有数据的视图，让函数可以接受数组、向量或字符串的一部分。

```rust
fn first_line(text: &str) -> &str {
    text.lines().next().unwrap_or("")
}

fn main() {
    let text = String::from("第一行\n第二行");
    println!("{}", first_line(&text));
}
```

当函数返回输入中的一个引用时，生命周期标注说明返回值和输入的存活关系。

```rust
fn longer<'a>(left: &'a str, right: &'a str) -> &'a str {
    if left.len() >= right.len() { left } else { right }
}

fn main() {
    println!("{}", longer("rust", "ownership"));
}
```

## 动手练习

1. 写 trimmed_words，返回非空单词切片。
2. 就地删除向量中已完成任务，避免返回新的向量。
3. 构造一次冲突借用错误，再用更短作用域修复。
4. 解释为什么不能返回局部 String 的引用。

## 常见报错与排查

- cannot borrow as mutable because it is also borrowed as immutable：先结束不可变引用，再取得可变引用。
- lifetime may not live long enough：确认返回数据确实来自输入引用。
- returns a reference to data owned by the current function：局部数据应返回 String，而不是引用。
- missing lifetime specifier：明确返回引用来自哪个输入，再补生命周期参数。

## 完成检查

- [ ] 能用可变引用修改调用者数据。
- [ ] 能用切片函数同时接受 Vec 和数组。
- [ ] 能说明生命周期标注描述的关系。

# 第 6 章：Result、错误处理、模块与测试

## 学习目标

- 用 Result 表达可失败操作。
- 使用问号运算符传播错误，在边界处展示错误。
- 组织模块和公开接口。
- 为纯函数和业务规则写测试。

## 核心讲解

Option 表示值可能不存在，Result 表示操作可能失败且失败有原因。不要在库代码里到处 unwrap；在程序边界把错误转换为用户能看懂的信息。

```rust
fn parse_count(input: &str) -> Result<u32, String> {
    let value = input
        .trim()
        .parse::<u32>()
        .map_err(|_| format!("不是有效的数字：{input}"))?;

    if value == 0 {
        Err(String::from("数量必须大于 0"))
    } else {
        Ok(value)
    }
}

fn main() {
    match parse_count("3") {
        Ok(value) => println!("数量：{value}"),
        Err(error) => eprintln!("错误：{error}"),
    }
}
```

业务错误最好用 enum 表达，让调用者能区分处理。

```rust
#[derive(Debug)]
enum LoadError {
    EmptyInput,
    InvalidNumber,
}

fn load_limit(input: &str) -> Result<usize, LoadError> {
    if input.trim().is_empty() {
        return Err(LoadError::EmptyInput);
    }
    input.trim().parse().map_err(|_| LoadError::InvalidNumber)
}

fn main() {
    println!("{:?}", load_limit("20"));
}
```

模块收拢实现细节，测试围绕可观察行为编写。

```rust
pub mod math {
    pub fn sum(values: &[i32]) -> i32 {
        values.iter().sum()
    }

    #[cfg(test)]
    mod tests {
        use super::sum;

        #[test]
        fn sums_values() {
            assert_eq!(sum(&[2, 3, 5]), 10);
        }
    }
}

fn main() {
    println!("{}", math::sum(&[1, 2, 3]));
}
```

## 动手练习

1. 把返回 -1 的解析函数改成 Result 和自定义错误。
2. 为任务添加标题为空和索引不存在两个业务错误。
3. 把业务逻辑拆到 src/task.rs，main.rs 只负责调用。
4. 为新增、完成和查询各写一个成功测试和一个失败测试。

## 常见报错与排查

- 问号运算符只能用于返回 Result 或 Option 的函数，检查当前函数签名。
- 测试或打印错误需要 Debug，给错误类型增加派生。
- unresolved import：检查文件名、mod 声明位置和 pub 可见性。
- 测试没有执行：检查 test 标记，运行 cargo test -- --nocapture 查看输出。

## 完成检查

- [ ] 能用问号运算符写两步连续的可失败操作。
- [ ] 能区分内部传播错误和程序边界展示错误。
- [ ] 至少有三个测试覆盖成功、边界和失败路径。

# 第 7 章：泛型、trait、迭代器与闭包

## 学习目标

- 使用泛型避免重复实现。
- 用 trait 描述共享能力。
- 用迭代器表达转换、过滤和聚合。
- 理解闭包捕获变量的方式。

## 核心讲解

泛型让函数适用于多个具体类型，trait bound 限定它必须具备的能力。先写具体版本，再在重复出现时抽泛型。

```rust
fn largest<T: PartialOrd + Copy>(values: &[T]) -> Option<T> {
    let mut result = values.first().copied()?;
    for &value in &values[1..] {
        if value > result {
            result = value;
        }
    }
    Some(result)
}

fn main() {
    println!("{:?}", largest(&[3, 8, 5]));
}
```

trait 可以作为参数约束，迭代器则用链式操作表达转换和筛选。

```rust
trait Summary {
    fn summary(&self) -> String;
}

struct Lesson {
    title: String,
    minutes: u32,
}

impl Summary for Lesson {
    fn summary(&self) -> String {
        format!("{}（{} 分钟）", self.title, self.minutes)
    }
}

fn completed_titles(tasks: &[(&str, bool)]) -> Vec<String> {
    tasks.iter()
        .filter(|(_, done)| *done)
        .map(|(title, _)| (*title).to_owned())
        .collect()
}

fn main() {
    let tasks = [("读文档", true), ("写代码", false)];
    println!("{:?}", completed_titles(&tasks));
}
```

迭代器是惰性的，直到 collect、sum 或 for 等消费操作发生才真正执行。

```rust
fn main() {
    let prefix = String::from("任务");
    let format_title = |title: &str| format!("{prefix}：{title}");
    println!("{}", format_title("学习迭代器"));
}
```

闭包可以借用环境变量，也可以用 move 获取捕获值的所有权。线程和异步任务常要求 move，因为任务可能比当前函数活得久。

## 动手练习

1. 为 Task 实现 Summary trait。
2. 筛选未完成任务，再按标题长度排序。
3. 把一个 for 循环改写为 filter、map 和 collect。
4. 给闭包加 move，观察它对外部 String 的所有权影响。

## 常见报错与排查

- trait bound 不满足：检查 impl 或 trait bound。
- type annotations needed：给泛型变量或函数调用补充明确类型。
- cannot move out of captured variable：确认闭包需要 move 还是只需借用。
- 迭代器没有执行：确认最后有 collect、count、sum 或 for。

## 完成检查

- [ ] 能为自己的 struct 实现一个 trait。
- [ ] 能解释迭代器为什么是惰性的。
- [ ] 能把重复逻辑抽成带 trait bound 的函数。


# 第 8 章：线程、Arc、Mutex 与消息通道

## 学习目标

- 创建线程并等待线程结束。
- 理解 Arc 的共享所有权和 Mutex 的互斥访问。
- 用 channel 传递消息，而不是让多个线程直接修改同一状态。
- 识别锁范围过大和线程无法退出的问题。

## 核心讲解

thread::spawn 创建独立执行单元，join 等待它结束。线程闭包通常需要 move，因为线程可能在当前函数返回后继续运行。

```rust
use std::thread;

fn main() {
    let worker = thread::spawn(|| (1..=3).sum::<i32>());
    let result = worker.join().expect("线程应正常结束");
    println!("结果：{result}");
}
```

Arc 允许多个线程共同拥有同一份数据；Mutex 保证同一时刻只有一个线程访问内部可变数据。锁住后尽快释放，不要在锁内执行慢的 I/O。

```rust
use std::sync::{Arc, Mutex};
use std::thread;

fn main() {
    let total = Arc::new(Mutex::new(0));
    let mut handles = Vec::new();

    for _ in 0..4 {
        let total = Arc::clone(&total);
        handles.push(thread::spawn(move || {
            let mut value = total.lock().expect("锁未中毒");
            *value += 1;
        }));
    }

    for handle in handles {
        handle.join().expect("线程应完成");
    }

    println!("总数：{}", total.lock().expect("锁未中毒"));
}
```

channel 适合把生产消息和处理状态分开。单线程拥有状态，其他线程只发送命令，通常更容易测试。

```rust
use std::sync::mpsc;
use std::thread;

fn main() {
    let (sender, receiver) = mpsc::channel();

    let worker = thread::spawn(move || {
        sender.send(String::from("任务完成")).expect("接收端仍在");
    });

    println!("{}", receiver.recv().expect("应收到消息"));
    worker.join().expect("线程应完成");
}
```

## 动手练习

1. 启动两个线程分别计算一半数组的和，主线程合并结果。
2. 用 Arc 和 Mutex 收集线程结果，再思考 channel 方案。
3. 写一个 worker 线程，接收 Add 和 Stop 消息。
4. 故意把 join 放在循环内部，观察它为什么失去并行意义。

## 常见报错与排查

- cannot be sent between threads safely：捕获的数据没有实现 Send，检查是否包含非线程安全类型。
- cannot be shared between threads safely：需要共享引用但类型没有实现 Sync，不要用 unsafe 绕过。
- deadlock 或程序不退出：检查锁顺序和 channel 的发送端是否全部释放。
- PoisonError：某线程在持锁时 panic，决定业务上是恢复、返回错误还是终止。

## 完成检查

- [ ] 能说明 Arc 解决共享所有权，Mutex 解决互斥访问。
- [ ] 能用 channel 设计一个停止消息。
- [ ] 能指出锁内不应该执行的慢操作。

# 第 9 章：Tokio 异步入门

## 学习目标

- 区分同步函数、异步函数和 Future。
- 使用 Tokio runtime、spawn 和异步 channel。
- 知道 await 让出执行权，不等于自动创建线程。
- 能判断一个任务是否适合异步化。

## 核心讲解

异步函数返回 Future，调用它只会构造任务，遇到 await 才会等待结果。异步适合大量 I/O 等待，例如网络、文件和定时器；纯 CPU 密集计算不能因为加了 async 就变快。

本章示例需要在 Cargo.toml 增加 Tokio。依赖版本以本机当前稳定版本为准。

```toml
[dependencies]
tokio = { version = "1", features = ["macros", "rt-multi-thread", "time", "sync"] }
```

使用宏创建 runtime：

```rust
#[tokio::main]
async fn main() {
    println!("异步程序启动");
    tokio::time::sleep(std::time::Duration::from_millis(20)).await;
    println!("异步等待结束");
}
```

spawn 会把 Future 放入 runtime 调度。异步任务适合等待外部资源时释放执行权。

```rust
#[tokio::main]
async fn main() {
    let first = tokio::spawn(async {
        tokio::time::sleep(std::time::Duration::from_millis(10)).await;
        "第一个结果"
    });

    let second = tokio::spawn(async { "第二个结果" });

    println!("{}", first.await.expect("任务未 panic"));
    println!("{}", second.await.expect("任务未 panic"));
}
```

异步 channel 适合生产者和消费者解耦：

```rust
#[tokio::main]
async fn main() {
    let (sender, mut receiver) = tokio::sync::mpsc::channel(8);

    let producer = tokio::spawn(async move {
        sender.send(String::from("一条事件")).await.expect("接收端存在");
    });

    if let Some(message) = receiver.recv().await {
        println!("收到：{message}");
    }

    producer.await.expect("生产者未 panic");
}
```

## 动手练习

1. 建立 Tokio 项目，用定时器模拟两个并发任务。
2. 把第 8 章的同步 channel 改成 Tokio mpsc。
3. 写一个 async 函数，返回 Result，在调用端传播错误。
4. 记录同步阻塞操作放进异步函数后的风险，并说明如何放到专用线程。

## 常见报错与排查

- main function is not allowed to be async：缺少 Tokio runtime 宏或 Cargo 特性没有打开。
- future cannot be sent between threads safely：跨任务捕获了非 Send 数据，缩短借用范围或换线程安全类型。
- Future 没有执行：只创建 Future 不会运行，确认调用处有 await 或交给 spawn。
- 异步程序卡住：检查 runtime 线程上是否执行了长时间同步阻塞工作。

## 完成检查

- [ ] 能解释 Future、await 和 runtime 的关系。
- [ ] 能启动两个 Tokio 任务并等待它们结束。
- [ ] 能区分 I/O 等待和 CPU 计算，避免盲目 async。

# 第 10 章：把学习内容组织成工程

## 学习目标

- 选择模块边界，而不是把所有逻辑塞进 main。
- 用数据模型、命令和错误类型表达业务。
- 为输入、核心逻辑和输出分别设计测试。
- 建立格式化、检查、测试的固定工作流。

## 核心讲解

一个可维护的小项目通常至少分三层：

- 输入层：解析命令行或请求，不直接修改核心状态；
- 领域层：定义 Task、命令和错误，保持可测试；
- 存储和输出层：负责文件、网络或终端，允许失败并返回 Result。

先做标准库版本，确认模型和业务规则稳定，再引入异步或第三方依赖。过早引入框架会把学习重点从 Rust 语义带到框架配置。

```rust
#[derive(Debug, PartialEq)]
struct Task {
    id: u32,
    title: String,
    done: bool,
}

#[derive(Debug, PartialEq)]
enum TaskError {
    EmptyTitle,
    MissingTask(u32),
}

fn add_task(tasks: &mut Vec<Task>, title: &str) -> Result<u32, TaskError> {
    if title.trim().is_empty() {
        return Err(TaskError::EmptyTitle);
    }

    let id = tasks.last().map(|task| task.id + 1).unwrap_or(1);
    tasks.push(Task {
        id,
        title: title.trim().to_owned(),
        done: false,
    });
    Ok(id)
}

fn main() {
    let mut tasks = Vec::new();
    println!("{:?}", add_task(&mut tasks, "完成项目"));
}
```

为业务逻辑写测试时，要覆盖输入边界和错误分支。命令行解析留在入口，用函数参数替代真实终端输入。

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_empty_title() {
        let mut tasks = Vec::new();
        assert_eq!(add_task(&mut tasks, "  "), Err(TaskError::EmptyTitle));
    }

    #[test]
    fn assigns_incrementing_ids() {
        let mut tasks = Vec::new();
        assert_eq!(add_task(&mut tasks, "第一项"), Ok(1));
        assert_eq!(add_task(&mut tasks, "第二项"), Ok(2));
    }
}
```

## 动手练习

1. 把第 3 章的 Task 搬进 src/task.rs，把 main.rs 变成薄入口。
2. 为完成任务和删除任务定义错误分支。
3. 加入 cargo fmt、cargo clippy 和 cargo test 到检查清单。
4. 写一段项目说明，记录为什么某个函数借用而不是接收所有权。

## 常见报错与排查

- 模块越来越大：按数据模型、业务操作、输入输出拆分，不要按每个函数一个文件机械拆分。
- 测试只能通过终端运行：把核心逻辑改成接收参数并返回值。
- clippy 提示并不等于编译错误：理解建议后再修改，必要时在局部加说明。
- 格式化造成大量无关 diff：统一使用项目根目录运行 cargo fmt。

## 完成检查

- [ ] main 只负责流程编排，核心规则可独立测试。
- [ ] 能为一个失败场景定义清楚的错误类型。
- [ ] 能用固定命令完成格式化、检查和测试。

# 第 11 章：综合复习与最终项目

## 学习目标

- 把前面各章的语义放进一个完整的小项目。
- 从同步、标准库版本开始，再选择性增加异步能力。
- 用验收标准判断自己是真会还是只看懂了示例。

## 核心讲解

最终项目建议实现任务管理器：

1. 用 struct 保存任务，用 enum 表达命令和错误。
2. 用 Vec 保存内存状态，实现新增、列出、完成、删除。
3. 让所有业务操作返回 Result，不在核心层使用 unwrap。
4. 先写单元测试，再接入命令行输入。
5. 最后增加文件保存或 Tokio 异步事件流。

项目的逐步实现说明见 project-tutorial.md。本文件负责教概念，项目文件负责把概念串起来，不要跳过中间检查点直接复制最终代码。

```rust
enum Command {
    Add { title: String },
    List,
    Done { id: u32 },
    Remove { id: u32 },
    Quit,
}

fn command_name(command: &Command) -> &'static str {
    match command {
        Command::Add { .. } => "add",
        Command::List => "list",
        Command::Done { .. } => "done",
        Command::Remove { .. } => "remove",
        Command::Quit => "quit",
    }
}

fn main() {
    println!("{}", command_name(&Command::List));
}
```

## 动手练习

1. 只看类型和验收标准，先自己写项目目录和核心类型。
2. 为每项业务操作各写一个成功测试和一个失败测试。
3. 给项目增加一个新命令，不修改已有命令的行为。
4. 把一次同步操作改成异步任务，并写下改变的原因和代价。

## 常见报错与排查

- 需求变成一堆 String：回到类型设计，检查是否应该使用 enum、Option 或 Result。
- 代码能运行但无法测试：把输入读取和业务逻辑拆开，先测试纯函数。
- 异步版本比同步版本更复杂：先确认是否真的有并发 I/O 需求，再决定是否引入 runtime。
- 修复借用错误后出现更多 clone：回到所有权边界，确认状态应由哪个模块拥有。

## 完成检查

- [ ] 能在没有教程代码的情况下画出项目模块图。
- [ ] 能解释每个核心类型为什么这样设计。
- [ ] 能运行测试并说明至少一个失败用例。
- [ ] 能说明同步版本和异步版本的适用边界。

## 最终验收表

- [ ] cargo fmt --check 通过。
- [ ] cargo check 通过。
- [ ] cargo test 至少覆盖新增、查询、完成、删除和错误输入。
- [ ] 所有权和借用边界有清晰注释或文档说明。
- [ ] 核心业务不依赖 unwrap 处理用户输入。
- [ ] 至少完成一个文件持久化或异步扩展。
- [ ] 能从日志或错误信息定位一次故意制造的失败。

## 延伸阅读

完成本地课程后，再按需要使用 resources.md 中的 GitHub 项目：

- Rustlings：把已学概念变成编译器练习；
- 100 Exercises to Learn Rust：按小题继续加深；
- Rust Book 和 Rust by Example：查概念与可运行示例；
- Tokio mini-redis：观察异步工程如何组织；
- Too Many Lists：专门补数据结构和所有权细节。

外部仓库的版本和任务会变化，本地课程的章节、练习和验收标准才是当前学习主线。
