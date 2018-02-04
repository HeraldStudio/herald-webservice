const cheerio = require('cheerio')
const axios = require('axios')

exports.route = {
  async get() {
    let { cardnum, schoolnum } = this.user

    let res = await this.post('http://10.1.30.98:8080/srtp2/USerPages/SRTP/Report3.aspx',`code=${schoolnum}`)
    if (res.status >= 400) {
      this.throw(res.status)
      return
    }

    let $ = cheerio.load(res.data)

    let stbody = []
    $('body')
      .children('form')
      .children('table')
      .children('tbody')
      .children('tr').eq(2)
      .children('td')
      .children('div')
      .children('table')
      .children('tbody')
      .children('tr')
      .each(function (i, tr) {
        stbody[i] = $(this)
      })

    let info = {
      points: stbody[stbody.length - 2].children('td').eq(6).text(),
      grade: stbody[stbody.length - 1].children('td').eq(6).text()
    }

    let projects = stbody.slice(2, -2).map(k => {
      let td = k.children('td')
      let project = {}
      ;['type', 'project', 'date', 'department', 'total', 'proportion', 'credit'].map((k, i) => {
        project[k] = td.eq(i).text().replace(/\s/g, '')
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
  }
}
