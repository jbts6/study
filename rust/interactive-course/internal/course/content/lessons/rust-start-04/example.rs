pub fn add_suffix(mut text: String, suffix: &str) -> String {
    text.push_str(suffix);
    text
}

pub fn archive_copy(text: &str) -> String {
    text.to_owned()
}
