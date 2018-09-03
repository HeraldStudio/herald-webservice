const cheerio = require('cheerio')
const db = require('../../database/course')
const { config } = require('../../app')

// 折合百分制成绩（本科生用）
const calculateEquivalentScore = score => {
  if (/优/.test(score)) {
    score = 95
  } else if (/良/.test(score)) {
    score = 85
  } else if (/中/.test(score)) {
    score = 75
  } else if (/不及格/.test(score)) {
    score = 0
  } else if (/及格|通过/.test(score)) {
    score = 60
  }
  return parseFloat(score) || 0
}

exports.route = {

  /**
  * GET /api/gpa
  * 成绩查询
  * 注意本科生和研究生返回结果格式略有不同
  **/
  async get() {
    return await this.userCache('1h+', async () => {

      // 先检查可用性，不可用直接抛异常或取缓存
      this.guard('http://xk.urp.seu.edu.cn/studentService/system/showLogin.action')

      await this.useAuthCookie()
      let { name, cardnum, schoolnum } = this.user

      // 本科生
      if (/^21/.test(cardnum)) {
        res = await this.get(
          'http://xk.urp.seu.edu.cn/studentService/cs/stuServe/studentExamResultQuery.action'
        )
        let $ = cheerio.load(res.data)
        
        // 计算去年的当前学期号，以便统计时进行过滤。
        // 早于去年当前学期的数据不再记录。
        let now = +moment()
        let currentTerm = (this.term.current || this.term.prev).name
        let prevYearCurrentTerm = currentTerm.split('-').map(Number).map((k, i) => i < 2 ? k - 1 : k).join('-')

        // 解析课程
        let detail = (await Promise.all($('#table2 tr').toArray().slice(1).map(async tr => {
          let [semester, cid, courseName, credit, score, scoreType, courseType]
            = $(tr).find('td').toArray().slice(1).map(td => {
              return $(td).text().trim().replace(/&[0-9A-Za-z];/g, '')
            })
            
          // 折合百分制成绩
          let equivalentScore = calculateEquivalentScore(score)
          
          // 是否通过
          // 获得学分的条件是首次通过，这里先计算是否通过，留给最后一起计算是否首次通过
          let isPassed = equivalentScore >= 60

          // 学分解析为浮点数
          credit = parseFloat(credit)

          // 不早于去年当前学期的数据，进行课程统计
          if (semester >= prevYearCurrentTerm) try {
            let course = await db.course.find({ cid }, 1)
            if (!course) {
              await db.course.insert(course = { cid, courseName, courseType, credit, avgScore: 0, sampleCount: 0, updateTime: 0 })
            }

            // 若分数可识别为数字且非零，更新课程的平均分
            // course.sampleCount 是原来的样本容量，sampleCount 是更新后的样本容量
            let sampleCount = course.sampleCount + 1

            // 三种情况：自己有分，原来也有均分，重新取平均；自己有分，原来没有均分，取自己的分；自己没分，不变
            let avgScore = equivalentScore ? course.avgScore ? (course.avgScore * course.sampleCount + equivalentScore) / sampleCount : equivalentScore : course.avgScore
            await db.course.update({ cid }, { courseName, courseType, credit, avgScore, sampleCount, updateTime: +moment() })

            // 课程学期信息插入课程学期表关系表
            if (scoreType === '首修') {
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
                record.updateTime = +moment()
                await db.courseSemester.insert(record)
              } else {
                await db.courseSemester.update(record, { updateTime: +moment() })
              }
            }
          } catch (e) {}
          
          // isFirstPassed 和 isHighestPassed 留给后面计算
          return {
            cid, semester,
            courseName, courseType, credit, score, equivalentScore,
            isPassed, isFirstPassed: false, isHighestPassed: false,
            scoreType
          }
        })))

        let [gpa, gpaBeforeMakeup, year, calculationTime]
          = $('#table4 tr').eq(1).find('td').toArray().map(td => {
          return $(td).text().trim().replace(/&[0-9A-Za-z];/g, '')
        })
        
        // 计算各门课程是否首次通过
        // 用于判断课程是否获得学分，以及用于前端判断课程是否默认计入校内绩点估算
        // 注意 reverse 是变更方法，需要先 slice 出来防止改变原数组的顺序
        let courseHasPassed = {}
        let achievedCredits = 0
        detail.slice().reverse().map(k => {
          // 赋值后判断如果是首次通过
          if ((k.isFirstPassed = k.isPassed && !courseHasPassed[k.cid])) {
            courseHasPassed[k.cid] = true
            
            // 更新已获得学分数
            achievedCredits += k.credit
          }
        })

        // 计算各门课程是否最高一次通过
        // 用于前端判断课程是否默认计入出国绩点估算
        let courseHighestPassed = {}
        detail.map(k => {
          if (k.isPassed && (!courseHighestPassed[k.cid] || k.equivalentScore > courseHighestPassed[k.cid].equivalentScore)) {
            courseHighestPassed[k.cid] = k
          }
        })
        Object.values(courseHighestPassed).map(k => k.isHighestPassed = true)
        
        // 按学期分组
        detail = detail.reduce((a, b) => {
          let semester = b.semester
          delete b.semester
          if (!a.length || a.slice(-1)[0].semester !== semester) {
            return a.concat([{ semester, courses: [b] }])
          } else {
            a.slice(-1)[0].courses.push(b)
            return a
          }
        }, [])

        // 时间解析为时间戳
        calculationTime = calculationTime ? +moment(calculationTime) : null
        this.logMsg = `${name} (${cardnum}) - 查询绩点`
        return { gpa, gpaBeforeMakeup, achievedCredits, year, calculationTime, detail }

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
