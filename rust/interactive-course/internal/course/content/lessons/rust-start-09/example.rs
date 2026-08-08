pub fn should_use_async(has_io_wait: bool, cpu_heavy: bool) -> bool {
    has_io_wait && !cpu_heavy
}

pub async fn ready_value(value: i32) -> i32 {
    value
}
