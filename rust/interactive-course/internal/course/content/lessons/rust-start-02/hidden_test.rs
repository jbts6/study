use rust_lesson::{pending_count, word_counts};

#[test]
fn counts_words_case_insensitively() {
    let counts = word_counts("Rust rust tools");
    assert_eq!(counts.get("rust"), Some(&2));
    assert_eq!(counts.get("tools"), Some(&1));
}

#[test]
fn counts_pending_items() {
    assert_eq!(pending_count(&[false, true, false]), 2);
    assert_eq!(pending_count(&[]), 0);
}
