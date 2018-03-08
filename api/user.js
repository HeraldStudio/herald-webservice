const cheerio = require('cheerio')

// FIXME 目前仅供本科生用
// FIXME 老信息门户疑似下线
exports.route = {
  async get () {
    await this.useAuthCookie()
    let res = await this.get('http://myold.seu.edu.cn/index.portal?.pn=p3447_p3449_p3450')
    let $ = cheerio.load(res.data)
    let [schoolnum, name, cardnum, gender, ethnicGroup]
      = $('.pa-main-table .portlet-table-even').toArray().map(k => $(k).text().trim())

    gender = gender.replace(/性$/, '')
    ethnicGroup = ethnicGroup.replace(/族$/, '')

    let [area, room, bedNum, bedCount, type]
      = $('.portlet-table-down td').toArray().map(k => $(k).text().trim()).slice(1)

    return {
      name, cardnum, schoolnum, gender, ethnicGroup,
      dormitory: {
        area, room, bedNum, bedCount, type
      }
    }
  }
}
