const cheerio = require("cheerio")
const encryptAES = require('../middleware/auth-provider/ids-encrypt')
exports.route = {
  async post() {
    // IDS Server 认证地址
    const url = 'https://newids.seu.edu.cn/authserver/login?service=http://srtp.seu.edu.cn/seu_back/Home/Cas'

    // Step 1：获取登录页面表单，解析隐藏值
    let res = await this.get(url)
    // console.log(res.data)
    let $ = cheerio.load(res.data)
    let form = { username: '213183580' }
    $('[tabid="01"] input[type="hidden"]').toArray().map(k => {
      if ($(k).attr('name')) {
        form[$(k).attr('name')] = $(k).attr('value')
      } else if ($(k).attr('id')) {
        form[$(k).attr('id')] = $(k).attr('value')
      }
    })
    form.password = encryptAES('rlh19991001', form.pwdDefaultEncryptSalt)
    // console.log(form)
    // Step 2：隐藏值与用户名密码一同 POST
    // 这个请求其实包含三个步骤：
    // 1. IDS 服务器解析表单参数，判断用户成功登陆，并生成 Ticket 作为参数，请求前端 302 跳到新信息门户；
    // 2. 前端再次 GET 请求带 Ticket 参数的新信息门户链接；
    // 3. 新信息门户取 Ticket 参数，私下与 IDS 服务器进行验证，验证成功后向前端颁发统一身份认证 Cookie。
    // 注：
    // 1. 新信息门户的统一身份认证 Cookie 同样包含 JSESSIONID（信息门户）和 iPlanetDirectoryPro（统一认证）两个字段。
    // 2. 此请求结束后，Cookie 将保留在 CookieJar 中，可访问信息门户和校内其他各类网站功能。
    res = await this.post(url, form)
    delete this.cookieJar.store.idx["srtp.seu.edu.cn"]
    res = await this.get('http://srtp.seu.edu.cn/seu_back/Home/Cas')
    console.log(res)
    console.log(this.cookieJar)
  }
}