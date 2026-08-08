#[derive(Debug, PartialEq, Eq)]
pub enum ParseAgeError {
    Empty,
    Invalid,
}

pub fn parse_age(_input: &str) -> Result<u8, ParseAgeError> {
    todo!("返回年龄或明确错误")
}
