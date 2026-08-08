use rust_lesson::greeting;

#[test]
fn hidden_greeting_test() {
    assert_eq!(greeting("Ada"), "Hello, Ada!");
}
