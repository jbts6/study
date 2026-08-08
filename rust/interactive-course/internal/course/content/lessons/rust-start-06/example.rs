#[derive(Debug, PartialEq, Eq)]
pub enum ParseAgeError {
    Empty,
    Invalid,
}

pub fn parse_age(input: &str) -> Result<u8, ParseAgeError> {
    let input = input.trim();
    if input.is_empty() {
        return Err(ParseAgeError::Empty);
    }
    input.parse::<u8>().map_err(|_| ParseAgeError::Invalid)
}
