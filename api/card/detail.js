const cheerio = require('cheerio')
const iconv = require('iconv-lite')

exports.route = {

  /**
   * GET /api/card/detail
   * @apiParam cardnum  一卡通号
   * @apiParam password 统一身份认证密码
   * @apiParam days     天数跨度，0 表示查询当天流水，其他数字不含当天流水
   * @apiParam page     页码
   **/
  async get() {
    let day = this.query.day || 0
    let page = this.query.page || 1

    // 取一卡通 Cookie
    let cookie = (await this.app.get('/api/card/cookie?' + this.querystring)).data

    // 取基本信息，需要用到其中的一卡通账号
    let base = (await this.app.get('/api/card?' + this.querystring)).data

    let res

    // 当天流水，直接查询
    if (day === 0) {

      // 这个页面是 GBK 的，需要手动解码
      res = await this.post(
        'http://allinonecard.seu.edu.cn/accounttodatTrjnObject.action',
        `pageVo.pageNum=${page}&account=${base.account}&inputObject=all`,
        { headers: { Cookie: cookie }, responseType: 'arraybuffer' }
      )
      res.data = iconv.decode(res.data, 'GBK')

    } else { // day 天历史流水，查询方式比较麻烦

      // 日期格式化用
      function dateFormat(d) {
        let result = d.getFullYear()
        let month = d.getMonth()
        result += (month < 10 ? '0' : '') + month
        let date = d.getDate()
        result += (date < 10 ? '0' : '') + date
        return result
      }

      // 先拼接起止日期
      let today = new Date()
      let end = dateFormat(today)
      today.setTime(today.getTime() - day * 1000 * 60 * 60 * 24)
      let start = dateFormat(today);

      // 四个地址要按顺序请求，前两个地址用于服务端跳转判定，不请求会导致服务端判定不通过；
      // 第三个地址只能查询第一页，无论 pageNum 值为多少，都只返回第一页；第四个地址可以查询任意页。
      for (let address of [
        'accounthisTrjn1.action',
        'accounthisTrjn2.action',
        'accounthisTrjn3.action',
        'accountconsubBrows.action'
      ]) {

        // 真正要的是最后一个接口的数据
        res = await this.post(
          'http://allinonecard.seu.edu.cn/' + address,
          `pageNum=${page}&account=${base.account}&inputObject=all&inputStartDate=${start}&inputEndDate=${end}`,
          { headers: { Cookie: cookie }, responseType: 'arraybuffer' }
        )
      }

      // GBK 解码
      res.data = iconv.decode(res.data, 'GBK')
    }

    // 直接上 jQuery
    let $ = cheerio.load(res.data)

    let rows = []
    $('#tables').children('tbody').children('tr').each((i, tr) => {
      let cells = []
      $(tr).children('td').each((i, td) => {
        cells.push($(td).text().trim())
      })

      // 接口设计规范，一定是数字的字段尽量转成数字；表示日期时间的字段转成毫秒时间戳
      if (cells.length >= 10) rows.push({
        id: parseInt(cells[7]),
        type: cells[3],
        place: cells[4],
        time: new Date(cells[0]).getTime(),
        amount: parseFloat(cells[5].replace(/,/g, '')),
        balance: parseFloat(cells[6].replace(/,/g, '')),
        state: cells[8],
        comment: cells[9]
      })
    })

    this.state.ttl = 1000 * 60 * 60 * 24
    return {
      result: rows.slice(1, -1), // 去掉首尾项
      pageCount: parseInt(/共(\d+)页/.exec(res.data)[1]) // 返回总页数
    }
  }
}
