const cheerio = require('cheerio')
const tough = require('tough-cookie')
const qs = require('querystring')

exports.route = {

  /**
  * GET /api/cwc/detail
  * @apiParam cookie 登录 caiwuchu.seu.edu.cn 获取的 JSESSION
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
