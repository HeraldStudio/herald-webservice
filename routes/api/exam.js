const cheerio = require('cheerio')

exports.route = {

  /**
  * GET /api/exam
  * 个人考试信息查询
  **/

  async get() {
    return await this.userCache('1d+', async () => {

      // 先检查可用性，不可用直接抛异常或取缓存
      this.guard('http://xk.urp.seu.edu.cn/studentService/system/showLogin.action')

      await this.useAuthCookie()
      // 经测试，使用老门户的 cookie，并不需要再登录教务处。
      let { name, cardnum } = this.user
      res = await this.get(
        'http://xk.urp.seu.edu.cn/studentService/cs/stuServe/runQueryExamPlanAction.action'
      )

      let $ = cheerio.load(res.data)
      let now = +moment()

      this.logMsg = `${name} (${cardnum}) - 查询考试安排`
      return $('#table2 tr').toArray().slice(1).map(tr => {
        let [semester, campus, courseName, courseType, teacherName, time, location, duration]
          = $(tr).find('td').toArray().slice(1).map(td => $(td).text().trim())

        let startMoment = moment(time, 'YYYY-MM-DD HH:mm(dddd)')
        let startTime = +startMoment
        let endTime = +startMoment.add(duration, 'minutes')

        return {semester, campus, courseName, courseType, teacherName, startTime, endTime, location, duration}
      }).filter(k => k.endTime > now) // 防止个别考生考试开始了还没找到考场🤔
    })
  }
}
