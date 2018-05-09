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

    // 这里假设同一院系年级上的同名同学分课程都是同一个课程，对同名课程进行合并
    // 用 max 实现查询短学期时自动附带下一个长学期
    return await db`
      select
        courseSemester.*,
        course.courseName,
        course.courseType,
        max(course.credit) credit,
        cast(sum(course.avgScore * course.sampleCount) / sum(course.sampleCount) as int) avgScore,
        sum(course.sampleCount) sampleCount,
        max(course.updateTime) updateTime
      from
        courseSemester inner join course
        on courseSemester.cid = course.cid
      where
        courseSemester.major = ${major}
        and courseSemester.grade = ${grade}
        and courseSemester.semester >= ${semester}
        and courseSemester.semester <= max(${semester}, 2)
        and course.courseType = ''
        and sampleCount > 2
      group by
        courseName, credit
      order by
        credit desc, courseName
    `
  }
}