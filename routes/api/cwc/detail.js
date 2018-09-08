const cheerio = require('cheerio')
const tough = require('tough-cookie')
const qs = require('querystring')

exports.route = {

  /**
  * GET /api/cwc/detail
  * 获取登录用验证码和cookie
  **/
  async get({ cookie }) {
    let headers = { cookie }
    let info = await this.get('http://caiwuchu.seu.edu.cn/payment/pay/payment.jsp', { headers })
    let $ = cheerio.load(info.data)
    let name = /WELCOME\s([\u4e00-\u9fa5]+)/im
    .exec($('table tbody tr td span').text())
    
    let res = await this.get('http://caiwuchu.seu.edu.cn/payment/pay/userfee_feeQuery.action', { headers })
    let item = eval('(' + res.data +')')
    item.username = name[1]
    return { item }
  }
}
