use std::sync::mpsc;

pub fn parallel_sum(values: &[i32]) -> i32 {
  let midpoint = values.len() / 2;
  let left = values[..midpoint].to_vec();
  let right = values[midpoint..].to_vec();
  let (sender, receiver) = mpsc::channel();
  let left_handle = std::thread::spawn(move || {
    let sum = left.into_iter().sum::<i32>();
    sender.send(sum).expect("result receiver dropped");
  });
  let right_sum = right.into_iter().sum::<i32>();
  let left_sum = receiver.recv().expect("worker thread stopped early");
  left_handle.join().expect("worker thread panicked");
  left_sum + right_sum
}
