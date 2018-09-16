const cheerio = require('cheerio')
const tough = require('tough-cookie')
const qs = require('querystring')

exports.route = {

  /**
  * GET /api/cwc/paycode/pay
  * @apiParam pwd 使用支付密码登录支付平台，获取缴费信息
  **/
  async get({ pwd }) {
    return 'qnmd'
  }
}
