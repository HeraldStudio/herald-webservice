exports.route = {
  get() {
    this.related('api', '所有功能接口')
    this.related('auth', {
      post: '{ cardnum, password, platform: /^[a-z\\-]$/ } 登录，得到的 token 带在 header.token 中使用'
    })
    return 'Herald WebService3'
  }
}
