use rust_lesson::{longest_word, mark_done};

#[test]
fn returns_a_slice_from_the_input() {
    let text = String::from("small longest");
    assert_eq!(longest_word(&text), Some("longest"));
}

#[test]
fn mutates_a_slice_without_panicking() {
    let mut items = [false, false];
    assert!(mark_done(&mut items, 1));
    assert_eq!(items, [false, true]);
    assert!(!mark_done(&mut items, 5));
}
