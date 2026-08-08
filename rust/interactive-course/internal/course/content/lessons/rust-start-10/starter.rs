#[derive(Debug, PartialEq, Eq)]
pub enum Command {
    Add(String),
    List,
    Quit,
}

pub fn parse_command(_input: &str) -> Option<Command> {
    todo!("把命令字符串解析为 enum")
}
