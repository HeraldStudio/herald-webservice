module.exports = {

  // 统一身份认证 cookie 获取层
  // 本方法需要 koa 的 ctx 作为 this 参数，但不建议通过 call 或 apply 直接调用
  // 建议使用自请求的方式调用，达到一定的缓存效果
  // 用法：(await this.app.get('/api/cookie?' + this.querystring)).data
  async get() {
    let cardnum = this.query.cardnum
    let password = this.query.password

    // 调用东大 APP 统一身份认证
    let res = await this.axios.post(
      'https://mobile4.seu.edu.cn/_ids_mobile/login18_9',
      `username=${cardnum}&password=${password}`
    )

    // 抓取 Cookie
    let cookie = res.headers['set-cookie']
    if (Array.isArray(cookie)) {
      cookie = cookie.filter(k => k.indexOf('JSESSIONID') + 1)[0]
    }
    cookie = /(JSESSIONID=[0-9A-F]+)\s*[;$]/.exec(cookie)[1]

    let { cookieName, cookieValue } = JSON.parse(res.headers.ssocookie)[0]

    // 设置缓存
    this.state.ttl = 1000 * 60 * 60 * 24
    return `${cookieName}=${cookieValue};${cookie}`
  }
}