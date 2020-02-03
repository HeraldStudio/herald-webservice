const cheerio = require('cheerio')

exports.route = {

  /**
  * GET /api/srtp
  * SRTP查询
  **/
  async get() {
    // return {
    //   info: {
    //     points: '2.0',
    //     grade: '及格'
    //   },
    //   projects: [
    //     {
    //       type: '竞赛获奖',
    //       project: '华为杯’东南大学第十五届大学生程序设计竞赛 校级 类 校级优秀奖',
    //       date: '2019年10月',
    //       department: '',
    //       total: 0.5,
    //       proportion: 1,
    //       credit: 0.5
    //     }
    //   ]
    // }
    return await this.userCache('30m+', async () => {
      let { schoolnum } = this.user

      let res = await this.post('http://10.1.30.98:8080/srtp2/USerPages/SRTP/Report3.aspx', `code=${schoolnum}`)

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
