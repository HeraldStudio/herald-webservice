exports.route = {
  get () {
    this.related('connection', {
      get: '[运维] 当前请求数、爬虫连接数、程序启动时间、待审核爬虫列表',
      post: '{ name } [运维] 接受爬虫',
      delete: '{ name } [运维] 拒绝爬虫',
    })
    this.related('daily', '[运维] 24 小时（48个时间段）接口调用统计')
    this.related('pull', '[运维] 线上更新代码')
    this.related('redis', '[运维] redis 状态')
    this.related('user', '[运维] 用户量及平台统计')
  }
}
