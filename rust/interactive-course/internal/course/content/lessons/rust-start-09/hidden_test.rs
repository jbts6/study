use rust_lesson::{ready_value, should_use_async};

#[test]
fn distinguishes_io_wait_from_cpu_work() {
    assert!(should_use_async(true, false));
    assert!(!should_use_async(false, false));
    assert!(!should_use_async(true, true));
}

#[test]
fn async_function_has_a_future_shape() {
    let future = ready_value(7);
    let _ = future;
}
