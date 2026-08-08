use rust_lesson::{add_suffix, archive_copy};

#[test]
fn moves_and_updates_owned_string() {
    assert_eq!(add_suffix("Rust".to_string(), " course"), "Rust course");
}

#[test]
fn creates_an_archive_copy_from_a_borrow() {
    let source = String::from("keep");
    assert_eq!(archive_copy(&source), "keep");
    assert_eq!(source, "keep");
}
