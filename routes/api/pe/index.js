const cheerio = require('cheerio')
const { config } = require('../../../app')

exports.route = {

  /**
  * GET /api/pe
  * 跑操查询
  **/
  async get() {
    let { count, detail, health } = await this.userCache('1h+', async () => {
      
      // 先检查可用性，不可用直接抛异常或取缓存
      this.guard('http://zccx.seu.edu.cn')

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
        return +moment(date).hour(hour).minute(min)
      })

      // 次数偶尔刷不出来，误显示为零，这种情况下暂时用详情的条数代替次数
      count = Math.max(count, detail.length)

      // 计算体测成绩
      $ = cheerio.load(healthHtml)
      let health = $('tr[height="30"]').toArray().map(k => {
        let [name, value, score, grade] = $(k).children('td').toArray().map(k => $(k).text().trim())
        value = parseFloat(value)
        score = parseFloat(score)
        return {name, value, score, grade}
      })

      return { count, detail, health }
    })

    // 剩余天数单独缓存，防止受跑操上游故障影响
    let remainDays = await this.publicCache('remainDays', '1h', async () => {
      let now = moment()
      let beginOfTerm = this.term.current && this.term.current.isLong && moment(this.term.current.startDate)

      return beginOfTerm ? (
        Array(16 * 7).fill() // 生成当前学期每一天的下标数组
          // 当前学期每一天的跑操结束时间戳
          // 注意这里要克隆一次，不能在原对象上直接操作
          .map((_, i) => beginOfTerm.clone().add(i, 'days').hour(7).minute(20))
          // 去掉已经过去的，转换成星期，去掉双休日，剩下的天数
          .filter(k => now < k).map(k => k.day()).filter(k => k >= 1 && k <= 5).length
      ) : 0
    })

    return { count, detail, health, remainDays }
  }
}
