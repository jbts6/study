pub fn classify_temperature(value: i32) -> &'static str {
    match value {
        value if value < 10 => "cold",
        value if value < 25 => "comfortable",
        _ => "hot",
    }
}

pub fn sum_even(limit: i32) -> i32 {
    (0..=limit).filter(|value| value % 2 == 0).sum()
}
