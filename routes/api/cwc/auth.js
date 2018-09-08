const cheerio = require('cheerio')
const tough = require('tough-cookie')
const qs = require('querystring')

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

  /**
  * POST /api/cwc/auth
  * 进行登录操作，返回token
  **/
  async post({uid, pwd, chkcode, cookie}) {
    cookie = cookie[0].split(';')[0]
    let headers = {cookie}
    let res = await this.post('http://caiwuchu.seu.edu.cn/payment/loginnewAction.action',qs.stringify({uid, pwd, chkcode}), {headers})
    
    if (res.data === 'uierror') {
      throw '用户名或密码错误'
    }

    if (res.data === 'chkcodeerror') {
      throw '验证码填写错误'
    }
    
    if (typeof(res.data) === 'object'){
      return {cookie}
    }
    console.log(typeof(res.data))
    console.log(res.data)
    throw '与财务处网站通讯出现故障'
  },

  async put({cardnum, idnum}) {
    let req = {
      'userinfo.userid':cardnum,
      'userinfo.idcardno':idnum
    }
    let res = await this.post('http://caiwuchu.seu.edu.cn/payment/login_resetPwd.action', qs.stringify(req))
    if (res.data == '1') {
      return '密码已重置'
    }
    if (res.data == '2') {
      throw '一卡通号或者身份证号不正确'
    }
    throw '与财务处网站通信出现故障'
  }
}
