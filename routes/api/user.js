const cheerio = require('cheerio')

exports.route = {

  /**
  * GET /api/user
  * 用户基本信息查询（静态版）
  **/
  async get () {
    await this.useAuthCookie() // 更新相关信息
    let { name, cardnum, schoolnum } = this.user
    let identity
    if (/^1/.test(cardnum)) {
      identity = '教师'
    }
    if (/^21/.test(cardnum)) {
      identity = '本科生'
    }
    if (/^22/.test(cardnum)) {
      identity = '硕士生'
    }
    if (/^23/.test(cardnum)) {
      identity = '博士生'
    }
    // 快速判断是否是新生
    let isNewbie = moment().format('YYYY-MM') < `20${cardnum.substr(3, 2)}-09`
    return { name, cardnum, schoolnum, identity, isNewbie }
  }
}