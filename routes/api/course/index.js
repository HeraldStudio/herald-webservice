const { config } = require('../../../app')
const db = require('../../../database/course')
const cheerio = require('cheerio')

/**
 * 必修、限选课统计信息的查询（课表预测）
 * 根据用户入学年份，通过给定的学期查询当前用户可能上到的课程
 * term      学期号如 17-18-3，不填表示下学期
 * schoolnum 要查询的院系年级学号前五位，登录用户可不传，不传查自己的，传了就查别人的
 */
exports.route = {
  async get({ term = 'next', schoolnum: querySchoolnum }) {
    if (!term) term = 'next'
    
    let cache = (this.user.isLogin ? this.userCache : this.publicCache).bind(this)
    return await cache('1h+', async () => {
      let schoolnum = querySchoolnum || this.user.schoolnum

      // 若为查下学期，计算下学期的学期号
      if (term === 'next') {
        term = this.term.next.name
      }

      // 如果是查自己的未来学期，自动过滤自己的已修课
      let courseTaken = {}
      if (this.user.isLogin && !querySchoolnum && term > (this.term.current || this.term.prev).name) {
        await this.useAuthCookie()

        // 获取用户已修课程的 id 用于过滤，遇到已修课程直接排除
        res = await this.get(
          'http://xk.urp.seu.edu.cn/studentService/cs/stuServe/studentExamResultQuery.action'
        )
        let $ = cheerio.load(res.data)
        let taken = await Promise.all($('#table2 tr').toArray().slice(1).map(async tr =>
          $($(tr).find('td').toArray()[2]).text().trim().replace(/&[0-9A-Za-z];/g, '')
        ))
        taken.map(k => courseTaken[k] = true)
      }

      // 解析院系专业和年级号
      let major = schoolnum.substr(0, 3).toUpperCase()
      let entryYear = parseInt(schoolnum.substr(3, 2))

      // 当前课程所在学期的年份后两位，取学期号前两位
      let semesterYear = parseInt(term.substr(0, 2))

      // 计算得到当前课程的年级，需要加一，使得大一为 1
      let grade = semesterYear - entryYear + 1

      // 学期次序，1 短学期，2 秋学期，3春学期
      let semester = parseInt(term.split('-')[2])

      // 这里假设同一院系年级上的同名同学分课程都是同一个课程，对同名课程进行合并
      // 用 max 实现查询短学期时自动附带下一个长学期
      return (await db`
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
          semester, credit desc, courseName
      `).filter(k => !courseTaken[k.cid])
    })
  }
}