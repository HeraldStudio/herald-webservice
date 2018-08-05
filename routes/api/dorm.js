const cheerio = require('cheerio')

exports.route = {
  async get() {
    await this.useAuthCookie()
    let res = await this.get(`http://hq.urp.seu.edu.cn/epstar/app/template.jsp?mainobj=SWMS/SSGLZXT/SSAP/V_SS_SSXXST&tfile=XSCKMB/BDTAG&filter=V_SS_SSXXST:XH='${this.user.cardnum}'`)
    let $ = cheerio.load(res.data)
    return {
      building: $('#SSL').text().trim(),
      room: $('#FJH').text().trim(),
      bed: $('#CWH').text().trim()
    }
  }
}