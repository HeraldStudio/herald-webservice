const cheerio = require('cheerio')
const db = require('../../database/course')

exports.route = {

  /**
  * GET /api/gpa
  * 成绩查询
  * 注意本科生和研究生返回结果格式略有不同
  **/
  async get() {
    return await this.userCache('1h+', async () => {
      await this.useAuthCookie()
      let { cardnum, schoolnum } = this.user

      // 本科生
      if (/^21/.test(cardnum)) {
        res = await this.get(
          'http://xk.urp.seu.edu.cn/studentService/cs/stuServe/studentExamResultQuery.action'
        )
        let $ = cheerio.load(res.data)
        let detail = (await Promise.all($('#table2 tr').toArray().slice(1).map(async tr => {
          let [semester, cid, courseName, credit, score, scoreType, courseType]
            = $(tr).find('td').toArray().slice(1).map(td => {
              return $(td).text().trim().replace(/&[0-9A-Za-z];/g, '')
            })

          // 学分解析为浮点数；成绩可能为中文，不作解析
          credit = parseFloat(credit)

          try /* 课程统计代码 */ {
            // 课程插入课程统计数据库
            let numberScore = parseFloat(score) || 0
            
            if (!numberScore) {
              if (/优/.test(score)) {
                numberScore = 95
              } else if (/良/.test(score)) {
                numberScore = 85
              } else if (/中/.test(score)) {
                numberScore = 75
              } else if (/不及格/.test(score)) {
                numberScore = 0
              } else if (/及格/.test(score)) {
                numberScore = 60
              }
            }
            let course = await db.course.find({ cid }, 1)
            if (!course) {
              await db.course.insert(course = { cid, courseName, courseType, credit, avgScore: 0, sampleCount: 0 })
            }

            // 若分数可识别为数字且非零，更新课程的平均分
            // course.sampleCount 是原来的样本容量，sampleCount 是更新后的样本容量
            let sampleCount = course.sampleCount + 1
            let avgScore = numberScore ? (course.avgScore * course.sampleCount + numberScore) / sampleCount : course.avgScore
            await db.course.update({ cid }, { courseName, courseType, credit, avgScore, sampleCount })

            // 课程学期信息插入课程学期表关系表
            if (scoreType !== '重修') {
              let major = schoolnum.substr(0, 3)

              // 入学年份后两位，必须在一卡通号里取，学号可能因为留级而变化
              let entryYear = parseInt(cardnum.substr(3, 2))

              // 当前课程所在学期的年份后两位，取学期号前两位
              let semesterYear = parseInt(semester.substr(0, 2))

              // 计算得到当前课程的年级，需要加一，使得大一为 1
              let grade = semesterYear - entryYear + 1

              // 学期次序，1 短学期，2 秋学期，3春学期
              let semesterIndex = parseInt(semester.split('-')[2])

              // 查找是否已有该记录，无该记录则插入
              let record = { cid, major, grade, semester: semesterIndex }
              let courseSemester = await db.courseSemester.find(record, 1)
              if (!courseSemester) {
                await db.courseSemester.insert(record, 1)
              }
            }
          } catch (e) {}
          return { cid, semester, courseName, courseType, credit, score, scoreType }

        }))).reduce((a, b) => { // 按学期分组
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
        calculationTime = calculationTime ? +moment(calculationTime) : null
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
            return { semester, courseName, courseType: '', credit, score, standardScore, scoreType }
          })
        })
        .reduce((a, b) => a.concat(b), [])
        .sort((a, b) => b.semester - a.semester)
        .reduce((a, b) => { // 按学期分组
          let semester = b.semester
          delete b.semester
          if (!a.length || a.slice(-1)[0].semester !== semester) {
            return a.concat([{ semester, courses: [b] }])
          } else {
            a.slice(-1)[0].courses.push(b)
            return a
          }
        }, [])

        let score = parseFloat($('#lblgghpjcj').text()) // 规格化平均成绩
        let degree = parseFloat($('#lblxwxf').text()) // 学位学分
        let optional = parseFloat($('#lblxxxf').text()) // 选修学分
        let total = parseFloat($('#lblyxxf').text()) // 总学分
        let required = parseFloat($('#lblyxxf1').text()) // 应修总学分
        let credits = { degree, optional, total, required }

        return { score, credits, detail }
      }
    })
  }
}
