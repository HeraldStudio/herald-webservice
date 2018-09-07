const cheerio = require('cheerio')
const tough = require('tough-cookie')
const qs = require('querystring')
const FormData = require('form-data')
exports.route = {

  /**
  * GET /api/cwc/auth
  * 获取登录用验证码和cookie
  **/
  async get() {
    let res = await this.get('http://caiwuchu.seu.edu.cn/payment/randomAction.action')
    cookie = res.headers['set-cookie']
    let image = Buffer.from(res.data).toString('base64')
    return { cookie, image }
  },

  async post({uid, pwd, chkcode, cookie}) {
    console.log(qs.stringify({ uid, pwd, chkcode }))
    cookie = cookie[0].split(';')[0]
    let headers = {cookie}
    console.log(cookie)
    let res = await this.post('http://caiwuchu.seu.edu.cn/payment/loginnewAction.action',qs.stringify({uid, pwd, chkcode}), {headers})
    if (typeof(res.data) === 'Buffer') {
      // 登录成功
      cookie = 
    }
  }
}
