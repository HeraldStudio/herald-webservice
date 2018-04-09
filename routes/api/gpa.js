const cheerio = require('cheerio')

exports.route = {

  /**
  * GET /api/gpa
  * 成绩查询
  **/
  async get() {
    return await this.userCache('1h+', async () => {
      await this.useAuthCookie()
      let { cardnum } = this.user

      // 本科生
      if (/^21/.test(cardnum)) {
        let { password } = this.user
        let captcha = await this.jwcCaptcha()

        await this.post(
          'http://xk.urp.seu.edu.cn/studentService/system/login.action',
          { userName: cardnum, password, vercode: captcha }
        )

        res = await this.get(
          'http://xk.urp.seu.edu.cn/studentService/cs/stuServe/studentExamResultQuery.action'
        )
        let $ = cheerio.load(res.data)
        let detail = $('#table2 tr').toArray().slice(1).map(tr => {
          let [semester, courseId, courseName, credit, score, scoreType, courseType]
            = $(tr).find('td').toArray().slice(1).map(td => {
              return $(td).text().trim().replace(/&[0-9A-Za-z];/g, '')
            })

          // 学分解析为浮点数；成绩可能为中文，不作解析
          credit = parseFloat(credit)
          return { semester, courseId, courseName, courseType, credit, score, scoreType }

        }).reduce((a, b) => { // 按学期分组
          let semester = b.semester
          delete b.semester
          if (!a.length || a.slice(-1)[0].semester !== semester) {
            return a.concat([{ semester, courses: [b] }])
          } else {
            a.slice(-1)[0].courses.push(b)
            return a
          }
        }, [])

        let [gpa, gpaBeforeMakeup, year, calculationTime]
          = $('#table4 tr').eq(1).find('td').toArray().map(td => {
          return $(td).text().trim().replace(/&[0-9A-Za-z];/g, '')
        })

        // 时间解析为时间戳
        calculationTime = calculationTime ? new Date(calculationTime).getTime() : null
        return { gpa, gpaBeforeMakeup, year, calculationTime, detail }

      } else if (/^22/.test(cardnum)) { // 研究生
        let headers = { 'Referer': 'http://121.248.63.139/nstudent/index.aspx' }

        // 获取成绩页
        let res = await this.get('http://121.248.63.139/nstudent/grgl/xskccjcx.aspx', { headers })
        let $ = cheerio.load(res.data)
        let detail = ['#dgData', '#Datagrid1'].map(k => $(k)).map((table, i) => {
          let scoreType = ['学位', '选修'][i]
          return table.find('tr').toArray().slice(1).map(k => $(k)).map(tr => {
            let [courseName, credit, semester, score, standardScore]
              = tr.children('td').toArray().map(k => $(k).text().trim())

            credit = parseFloat(credit)
            score = `${score} (规${standardScore})`
            return { semester, courseName, courseType: '', credit, score, scoreType }
          })
        }).reduce((a, b) => a.concat(b), []).reduce((a, b) => { // 按学期分组
          let semester = b.semester
          delete b.semester
          if (!a.length || a.slice(-1)[0].semester !== semester) {
            return a.concat([{ semester, courses: [b] }])
          } else {
            a.slice(-1)[0].courses.push(b)
            return a
          }
        }, [])

        // 规格化平均成绩
        let gpa = parseFloat($('#lblgghpjcj').text())
        let now = new Date()
        let year = now.getFullYear()

        return { gpa, gpaBeforeMakeup: gpa, year, calculationTime: now.getTime(), detail }
      }
    })
  }
}
