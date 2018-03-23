const cheerio = require('cheerio')

exports.route = {

  /**
   * GET /api/lecture
   * 人文讲座信息查询
   **/
  async get() {
    return await this.userCache('1h+', async () => {
      await this.useAuthCookie()
      await this.get('http://allinonecard.seu.edu.cn/ecard/dongnanportalHome.action')

      // 获取账号信息
      let res = await this.get('http://allinonecard.seu.edu.cn/accounthisTrjn.action')
      let $ = cheerio.load(res.data)
      let account = $("#account option").attr('value')

      // 获取记录页数
      res = await this.post('http://allinonecard.seu.edu.cn/mjkqBrows.action', { account, startDate: '', endDate: '' })
      $ = cheerio.load(res.data)
      let length = $("#pagetotal").text()

      // 根据长度生成 [0, length) 的整数数组用于流式编程
      // 相当于调用 Python range 函数
      let range = [].slice.call([].fill.call({ length }, 0)).map((k, i) => i)

      // 并行获取每一页数据
      return (await Promise.all(range.map(async i => {
        res = await this.post(
          'http://allinonecard.seu.edu.cn/mjkqBrows.action',
          { account, startDate: '', endDate: '', pageno: i + 1 }
        )
        $ = cheerio.load(res.data)
        return $('.dangrichaxun tr').toArray().slice(1,-1).map(tr => {
          let td = $(tr).find('td')
          let location = td.eq(-1).text()
          let time = new Date(td.eq(0).text()).getTime()
          return { time, location }
        })
      }))).reduce((a, b) => a.concat(b), []).filter(k =>
        !/^(九龙湖|手持考|行政楼|网络中|机电大|校医院|研究生)/.test(k.location)
      )
    })
  }
}
