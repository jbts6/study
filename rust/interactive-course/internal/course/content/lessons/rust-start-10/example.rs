#[derive(Debug, PartialEq, Eq)]
pub enum Command {
    Add(String),
    List,
    Quit,
}

pub fn parse_command(input: &str) -> Option<Command> {
    let mut parts = input.trim().splitn(2, ' ');
    let command = parts.next()?.to_ascii_lowercase();
    match command.as_str() {
        "add" => {
            let title = parts.next()?.trim();
            (!title.is_empty()).then(|| Command::Add(title.to_owned()))
        }
        "list" => Some(Command::List),
        "quit" => Some(Command::Quit),
        _ => None,
    }
}
