pub fn should_use_async(_has_io_wait: bool, _cpu_heavy: bool) -> bool {
    todo!("判断异步适用边界")
}

pub async fn ready_value(_value: i32) -> i32 {
    todo!("返回一个 ready future")
}
