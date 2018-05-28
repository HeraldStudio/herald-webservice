const cheerio = require('cheerio')

exports.route = {

  /**
  * GET /api/srtp
  * SRTP查询
  **/
  async get() {
    return await this.userCache('1d+', async () => {

      // 先检查可用性，不可用直接抛异常或取缓存
      this.guard('http://10.1.30.98:8080/srtp2/USerPages/SRTP/Report3.aspx')

      let { cardnum, schoolnum } = this.user

      let res = await this.post('http://10.1.30.98:8080/srtp2/USerPages/SRTP/Report3.aspx',`code=${schoolnum}`)

      let $ = cheerio.load(res.data)

      let stbody = []
      $('#table1 tr').each((i, tr) => stbody.push($(tr)))

      let info = {
        points: stbody[stbody.length - 2].children('td').eq(6).text(),
        grade: stbody[stbody.length - 1].children('td').eq(6).text()
      }

      let projects = stbody.slice(2, -2).map(k => {
        let td = k.children('td')
        let project = {}
        'type,project,date,department,total,proportion,credit'.split(',').map((k, i) => {
          project[k] = td.eq(i).text().replace(/\s+/g, ' ').trim()
        })

        if (parseFloat(project.credit)) {
          project.credit = parseFloat(project.credit)
        } else {
          project.credit = 0
        }

        if (parseFloat(project.proportion)) {
          project.proportion = parseFloat(project.proportion) / 100
        } else {
          project.proportion = 1
        }

        if (parseFloat(project.total)) {
          project.total = parseFloat(project.total)
        } else {
          project.total = project.credit / project.proportion
        }
        return project
      })

      return { info, projects }
    })
  }
}
