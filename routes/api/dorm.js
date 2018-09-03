const cheerio = require('cheerio')

exports.route = {
  async get() {
    await this.useAuthCookie()
    let { name, cardnum } = this.user
    // 从总务处网站可以进入到这里，是一个三层框架套住的页面
    let res = await this.get(`http://hq.urp.seu.edu.cn/epstar/app/template.jsp?mainobj=SWMS/SSGLZXT/SSAP/V_SS_SSXXST&tfile=XSCKMB/BDTAG&filter=V_SS_SSXXST:XH='${cardnum}'`)
    let $ = cheerio.load(res.data)
    this.logMsg = `${name} (${cardnum}) - 查询宿舍信息`
    return {
      campus: $('#XQ').text().trim(),
      area: $('#SSQ').text().trim(),
      building: $('#SSL').text().trim(),
      room: $('#FJH').text().trim(),
      bed: $('#CWH').text().trim()
    }
  }
}