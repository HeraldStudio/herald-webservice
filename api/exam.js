const cheerio = require('cheerio')

exports.route = {

  /**
   *
   * GET /api/exam
   * 个人考试信息查询
   *
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
    let detail = $('#table2 tr').toArray().slice(1).map(tr => {
      let [semester, campus, course, courseType, teacher, time, place, duration]
        = $(tr).find('td').toArray().slice(1).map(td => {
          return $(td).text().trim()
        })

      return {semester, campus, course, courseType, teacher, time, place, duration}
    })

    return detail
  }
}
