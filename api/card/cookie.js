exports.route = {

  /**
   * GET /api/card/cookie
   * @apiParam cardnum  一卡通号
   * @apiParam password 统一身份认证密码
   *
   * 一卡通专用 Cookie，除统一身份认证 Cookie 外还包含了一卡通中心的 Cookie
   **/
  async get() {

    // 先获取统一身份认证 Cookie
    let cookie = (await this.app.get('/api/cookie?' + this.querystring)).data

    // 再用统一身份认证 Cookie 获取一卡通中心 Cookie
    let res = await this.get('http://allinonecard.seu.edu.cn/ecard/dongnanportalHome.action', {
      headers: { Cookie: cookie }
    })

    // 拼接两个 Cookie
    let cardCookie = res.headers['set-cookie']
    if (Array.isArray(cardCookie)) {
      cardCookie = cardCookie[0]
    }
    cookie += ';' + /(JSESSIONID=[0-9A-F]+)\s*[;$]/.exec(cardCookie)[1]

    // 设置缓存
    this.state.ttl = 1000 * 60 * 60 * 24
    return cookie
  }
}
