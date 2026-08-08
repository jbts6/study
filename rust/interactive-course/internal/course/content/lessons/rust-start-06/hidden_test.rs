use rust_lesson::{parse_age, ParseAgeError};

#[test]
fn parses_valid_age() {
    assert_eq!(parse_age(" 42 "), Ok(42));
}

#[test]
fn reports_empty_and_invalid_input() {
    assert_eq!(parse_age("  "), Err(ParseAgeError::Empty));
    assert_eq!(parse_age("old"), Err(ParseAgeError::Invalid));
    assert_eq!(parse_age("256"), Err(ParseAgeError::Invalid));
}
