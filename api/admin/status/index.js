exports.route = {
  get () {
    this.related('daily', '[运维] 24 小时（48个时间段）接口调用统计')
    this.related('upstream', '[运维] 上游健康状况统计（超时1秒）')
    this.related('user', '[运维] 用户量及平台统计')
  }
}
