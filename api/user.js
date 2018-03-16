const cheerio = require('cheerio')

exports.route = {
  async get () {
    let { cardnum, schoolnum, name } = this.user
    let [ type, grade ] = cardnum.slice(0, 2).split('').map(k => k - 1)
    let identity = type ? ['本科生', '硕士生', '博士生'][grade] : '教师'
    return { cardnum, schoolnum, name, identity }
  }
}
