pub fn longest_word<'a>(text: &'a str) -> Option<&'a str> {
    text.split_whitespace().max_by_key(|word| word.chars().count())
}

pub fn mark_done(items: &mut [bool], index: usize) -> bool {
    if let Some(item) = items.get_mut(index) {
        *item = true;
        true
    } else {
        false
    }
}
