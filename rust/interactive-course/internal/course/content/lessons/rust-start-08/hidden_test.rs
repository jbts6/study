use rust_lesson::parallel_sum;

#[test]
fn sums_values_in_parallel() {
    assert_eq!(parallel_sum(&[1, 2, 3, 4, 5, 6]), 21);
}

#[test]
fn handles_empty_input() {
    assert_eq!(parallel_sum(&[]), 0);
}
