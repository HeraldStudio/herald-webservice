const cheerio = require('cheerio')
const { config } = require('../app')

exports.route = {

  /**
   * GET /api/pe
   * 跑操查询
   **/
  async get() {

    // 取统一身份认证 Cookie，登录早操查询网站，拿到网站 Session Cookie
    await this.useAuthCookie()
    await this.get('http://zccx.seu.edu.cn')

    // 为了加快速度，预先并行获取跑操次数、跑操详情、体测成绩三个页面
    let { cardnum } = this.user
    let [countHtml, detailHtml, healthHtml] = await Promise.all([
      'http://zccx.seu.edu.cn/student/queryCheckInfo.jsp',
      'http://zccx.seu.edu.cn/SportWeb/gym/gymExercise/gymExercise_query_result_2.jsp?xh=' + cardnum,
      'http://zccx.seu.edu.cn/student/queryHealthInfo.jsp'
    ].map(async k => {
      return (await this.get(k)).data
    }))

    // 计算跑操次数
    let $ = cheerio.load(countHtml)
    let count = $('td + td[bgcolor]').toArray().map(k => {
      let text = $(k).text()
      return parseInt(/\d+/.exec(text)[0])
    }).reduce((a, b) => a + b, 0)

    // 计算跑操详情（每次打卡时间戳）
    $ = cheerio.load(detailHtml)
    let detail = $('tr[height="30"]').toArray().map(k => {
      let [date, time] = $(k).children('td').toArray().map(k => $(k).text()).slice(3)
      let [hour, min] = /^\d+\.\d{2}/.exec(time + '0')[0].split('.').map(k => parseInt(k))
      let d = new Date(date)
      d.setHours(hour)
      d.setMinutes(min)
      return d.getTime()
    })

    // 计算体测成绩
    $ = cheerio.load(healthHtml)
    let health = $('tr[height="30"]').toArray().map(k => {
      let [name, value, score, grade] = $(k).children('td').toArray().map(k => $(k).text().trim())
      value = parseFloat(value)
      score = parseFloat(value)
      return {name, value, score, grade}
    })

    // 计算剩余天数
    let now = new Date().getTime()
    let beginOfTerm = Object.keys(config.term)
      .filter(k => /-[23]$/.test(k))                // 取两个长学期
      .map(k => new Date(config.term[k]).getTime())  // 转为学期开始时间戳
      // 去掉未开始和已结束的，留下一个学期，或者 undefined（没有符合条件的学期）
      .filter(k => k <= now && k + 1000 * 60 * 60 * 24 * 7 * 16 > now)[0]

    let remainDays = beginOfTerm ? (
      Array(16 * 7).fill() // 生成当前学期每一天的下标数组
        // 当前学期每一天的跑操结束时间戳
        .map((_, i) => beginOfTerm + 1000 * 60 * ((i * 60 * 24) + (7 * 60 + 20)))
        // 去掉已经过去的，转换成星期，去掉双休日，剩下的天数
        .filter(k => now < k).map(k => new Date(k).getDay()).filter(k => k >= 1 && k <= 5).length
    ) : 0

    return { count, detail, health, remainDays }
  }
}
