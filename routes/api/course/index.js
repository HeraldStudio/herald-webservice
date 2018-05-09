const { config } = require('../../../app')
const db = require('../../../database/course')

/**
 * 必修、限选课统计信息的查询（课表预测）
 * 根据用户入学年份，通过给定的学期查询当前用户可能上到的课程
 * term 为空表示当前学期，为 'next' 表示下学期
 */
exports.route = {
  async get({ term }) {
    let { cardnum, schoolnum } = this.user
    let now = +moment()
    let currentTerm = Object.keys(config.term).find(k => {
      let startMoment = moment(config.term[k], 'YYYY-M-D')
      let startDate = +startMoment
      let endDate = +startMoment.add(/-1$/.test(k) ? 4 : 18, 'weeks')
      return startDate <= now && endDate > now
    })

    if (!term) {
      term = currentTerm
    }
    
    if (term === 'next') {
      let [startYear, endYear, semester] = currentTerm.split('-').map(Number)
      semester++
      if (semester > 3) {
        semester = 1
        startYear++
        endYear++
      }
      term = [startYear, endYear, semester].join('-')
    }

    let major = schoolnum.substr(0, 3)

    // 入学年份后两位，必须在一卡通号里取，学号可能因为留级而变化
    let entryYear = parseInt(cardnum.substr(3, 2))

    // 当前课程所在学期的年份后两位，取学期号前两位
    let semesterYear = parseInt(term.substr(0, 2))

    // 计算得到当前课程的年级，需要加一，使得大一为 1
    let grade = semesterYear - entryYear + 1

    // 学期次序，1 短学期，2 秋学期，3春学期
    let semester = parseInt(term.split('-')[2])

    // 若查询短学期，改成短学期和秋学期同时查询
    if (semester === 1) {
      semester = { $lt: 3 }
    }

    // 为了条件书写方便，这里没法用 join，手动查两次目前看来无所谓
    let result = await db.courseSemester.find({ major, grade, semester })
    return (await Promise.all(result
      .map(async k => await db.course.find({ cid: k.cid }, 1))
    )).map(k => {
        k.avgScore = Math.round(k.avgScore)
        return k
      })
      .filter(k => !k.courseType && k.sampleCount > 2) // 去掉样本很少的（可能是转专业数据）
      .sort((a, b) => b.credit - a.credit) // 按学分倒序
  }
}