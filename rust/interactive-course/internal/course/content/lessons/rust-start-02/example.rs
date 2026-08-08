use std::collections::HashMap;

pub fn word_counts(text: &str) -> HashMap<String, usize> {
    let mut counts = HashMap::new();
    for word in text.split_whitespace() {
        let key = word.to_lowercase();
        *counts.entry(key).or_insert(0) += 1;
    }
    counts
}

pub fn pending_count(items: &[bool]) -> usize {
    items.iter().filter(|done| !**done).count()
}
