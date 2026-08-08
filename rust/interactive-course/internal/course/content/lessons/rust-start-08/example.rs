pub fn parallel_sum(values: &[i32]) -> i32 {
    let midpoint = values.len() / 2;
    let left = values[..midpoint].to_vec();
    let right = values[midpoint..].to_vec();
    let left_handle = std::thread::spawn(move || left.into_iter().sum::<i32>());
    let right_sum = right.into_iter().sum::<i32>();
    left_handle.join().expect("worker thread panicked") + right_sum
}
