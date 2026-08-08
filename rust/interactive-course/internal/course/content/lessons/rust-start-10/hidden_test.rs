use rust_lesson::{parse_command, Command};

#[test]
fn parses_commands() {
    assert_eq!(parse_command("add learn Rust"), Some(Command::Add("learn Rust".into())));
    assert_eq!(parse_command("list"), Some(Command::List));
    assert_eq!(parse_command("QUIT"), Some(Command::Quit));
}

#[test]
fn rejects_invalid_commands() {
    assert_eq!(parse_command("add"), None);
    assert_eq!(parse_command("remove task"), None);
}
