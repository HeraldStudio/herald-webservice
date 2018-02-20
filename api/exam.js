const cheerio = require('cheerio')

exports.route = {

  /**
   * GET /api/exam
   * 个人考试信息查询
   **/

  async get() {
    await this.useAuthCookie()
    let { cardnum, password } = this.user
    let res = (await this.get('https://boss.myseu.cn/jwccaptcha/')).data

    // 从验证码解析系统获取一次性 Cookie 和解析后的验证码
    let { cookies, captcha } = res
    this.cookieJar.setCookieSync(cookies, 'http://xk.urp.seu.edu.cn/', {})

    await this.post(
      'http://xk.urp.seu.edu.cn/studentService/system/login.action',
      { userName: cardnum, password, vercode: captcha }
    )

    res = await this.get(
      'http://xk.urp.seu.edu.cn/studentService/cs/stuServe/runQueryExamPlanAction.action'
    )
    let $ = cheerio.load(res.data)
    return $('#table2 tr').toArray().slice(1).map(tr => {
      let [semester, campus, courseName, courseType, teacherName, time, location, duration]
        = $(tr).find('td').toArray().slice(1).map(td => $(td).text().trim())

      duration = parseInt(duration)

      let [y, M, d, h, m] = time.split(/[- :(]/g)

      let startTime = new Date(y, M - 1, d, h, m)
      let endTime = new Date(start.getTime() + duration * 1000 * 60)

      return {semester, campus, courseName, courseType, teacherName, startTime, endTime, location, duration}
    })
  }
}
