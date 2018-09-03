const cheerio = require('cheerio')
const locations = {
  37: '教一-111',
  62: '教三-105'
}

exports.route = {

  /**
  * GET /api/lecture
  * 人文讲座信息查询
  **/
  async get() {
    return await this.userCache('1h+', async () => {

      // 先检查可用性，不可用直接抛异常或取缓存
      this.guard('http://allinonecard.seu.edu.cn/homeLogin.action')

      await this.useAuthCookie()
      await this.get('http://allinonecard.seu.edu.cn/ecard/dongnanportalHome.action')

      // 获取账号信息
      let res = await this.get('http://allinonecard.seu.edu.cn/accounthisTrjn.action')
      let $ = cheerio.load(res.data)
      let account = $("#account option").attr('value')

      // 获取记录页数
      res = await this.post('http://allinonecard.seu.edu.cn/mjkqBrows.action', { account, startDate: '', endDate: '' })
      $ = cheerio.load(res.data)
      let length = parseInt($("#pagetotal").text())

      // 根据长度生成 [0, length) 的整数数组用于流式编程
      // 相当于调用 Python range 函数
      let range = Array(length).fill().map((_, i) => i)
      let { name, cardnum } = this.user
      this.logMsg = `${name} (${cardnum}) - 查询讲座打卡记录`
      // 并行获取每一页数据
      return (await Promise.all(range.map(async i => {
        res = await this.post(
          'http://allinonecard.seu.edu.cn/mjkqBrows.action',
          { account, startDate: '', endDate: '', pageno: i + 1 }
        )
        $ = cheerio.load(res.data)
        return $('.dangrichaxun tr').toArray().slice(1,-1).map(tr => {
          let td = $(tr).find('td')
          let machineId = parseInt(td.eq(2).text().trim())
          let time = +moment(td.eq(0).text())
          return { time, machineId }
        })
      }))).reduce((a, b) => a.concat(b), [])
        // 只保留讲座打卡记录
        .filter(k => k.machineId in locations)
        // 按时间倒序，然后去除相距1分钟以内的同一卡机重复打卡记录
        .sort((a, b) => b.time - a.time)
        .filter((k, i, arr) => i === 0
          || arr[i - 1].machineId !== k.machineId
          || Math.abs(arr[i - 1].time - k.time) > 60 * 1000)
        // 转换为时间和地点名称
        .map(k => ({ time: k.time, location: locations[k.machineId] }))
    })
  }
}
