const cheerio = require('cheerio')

exports.route = {
  async get() {
    await this.useAuthCookie()
    // 从总务处网站可以进入到这里，是一个三层框架套住的页面
    let res = await this.get(`http://hq.urp.seu.edu.cn/epstar/app/template.jsp?mainobj=SWMS/SSGLZXT/SSAP/V_SS_SSXXST&tfile=XSCKMB/BDTAG&filter=V_SS_SSXXST:XH='${this.user.cardnum}'`)
    let $ = cheerio.load(res.data)
    return {
      campus: $('#XQ').text().trim(),
      area: $('#SSQ').text().trim(),
      building: $('#SSL').text().trim(),
      room: $('#FJH').text().trim(),
      bed: $('#CWH').text().trim()
    }
  }
}