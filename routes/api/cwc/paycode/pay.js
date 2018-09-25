const cheerio = require('cheerio')
const tough = require('tough-cookie')
const qs = require('querystring')

exports.route = {

  /**
  * GET /api/cwc/paycode/pay
  * @apiParam pwd 使用支付密码登录支付平台，获取缴费信息
  **/
  async get({ pwd }) {
    let res = await this.get(`http://payment.seu.edu.cn/pay/dealPay.html?pwd=${pwd}`)
    let keys = ['projectName', 'rIdExt', 'currencyTypeShow','amount','pwd']
    let payInfo = {
      'paid':/"hasPay"/im.exec(res.data) ? [true, true] : [false, false],
      'projectName': /"projectName":"([0-9A-Za-z\u4e00-\u9fa5\s]+)"/im.exec(res.data),
      'rIdExt': /"rIdExt":"([0-9A-Za-z]+)"/im.exec(res.data),
      'currencyTypeShow': /"currencyTypeShow":"([0-9A-Za-z\u4e00-\u9fa5\[\]]+)"/im.exec(res.data),
      'amount': /"amount":"([0-9\.]+)"/im.exec(res.data),
      'userName': /"userName":"([A-Za-z\u4e00-\u9fa5\s]+)"/im.exec(res.data),
      'pwd': /\{"pwd":"([0-9A-Z]+)"\}/im.exec(res.data),
      'overTime' : /"overTime":"([0-9\s\-\:]+)"/im.exec(res.data),
      'payAmount': /"payAmount":"([0-9\.]+)"/im.exec(res.data),
    }
    Object.keys(payInfo).forEach(k => {
      payInfo[k] = payInfo[k] ? payInfo[k][1] : '未知'
    })
    if (!payInfo.paid && payInfo.pwd === '未知') {
      throw '支付码有误'
    }
    payInfo.amount = parseFloat(payInfo.amount) ? parseFloat(payInfo.amount) : 0
    payInfo.payAmount = parseFloat(payInfo.payAmount) ? parseFloat(payInfo.payAmount) : 0
    payInfo.url = `http://payment.seu.edu.cn/pay/deal_CCB_union.html?autoSubmit=Y&realPay=1&pwd=${payInfo.pwd}`
    return payInfo
  }
}
