use rust_lesson::{classify_temperature, sum_even};

#[test]
fn temperature_boundaries() {
    assert_eq!(classify_temperature(9), "cold");
    assert_eq!(classify_temperature(10), "comfortable");
    assert_eq!(classify_temperature(25), "hot");
}

#[test]
fn even_sum() {
    assert_eq!(sum_even(10), 30);
    assert_eq!(sum_even(-1), 0);
}
