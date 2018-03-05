const cheerio = require('cheerio')
const sites = {
  jwc: {
    baseUrl: 'http://jwc.seu.edu.cn',
    infoUrl: 'http://jwc.seu.edu.cn',
    list: [
      ['#wp_news_w5', "教务信息"],
      ['#wp_news_w6', "学籍管理"],
      ['#wp_news_w7', "实践教学"],
      ['#wp_news_w8', "国际交流"],
      ['#wp_news_w9', "教学研究"]
    ]
  },
  zwc: {
    baseUrl: 'http://zwc.seu.edu.cn',
    infoUrl: 'http://zwc.seu.edu.cn/4297/list.htm',
    list: [['#wp_news_w3', '总务处公告']]
  },
}
// 5 天之内的信息，全部留下
const keepTime = 1000 * 60 * 60 * 24 * 5
// 10 条以内的信息，全部留下
const keepNum = 10

exports.route = {

  /**
   * GET /api/notification
   * @apiReturn [{ category, title, url, time, isAttachment, isImportant }]
   */
  async get () {
    let now = new Date().getTime()
    let ret = []
    for (const site of Object.getOwnPropertyNames(sites)) {
      let res = await this.get(sites[site].infoUrl)
      let $ = cheerio.load(res.data)
      let list = sites[site].list

      let timeList = list.map
      (ele =>
       $(ele[0]).find('div').toArray()
       .filter(arr => /\d+-\d+-\d+/.test($(arr).text()))
       .map(item => new Date($(item).text()).getTime())
      ).reduce((a, b) => a.concat(b), [])

      ret = ret.concat(
        list.map(
          ele =>
            $(ele[0]).find('a').toArray()
            .map(k => $(k)).map(k => {
              let href = k.attr('href')
              return {
                category: ele[1],
                title: k.attr('title'),
                url: /^\//.test(href)
                  ? sites[site].baseUrl + href
                  : href,
                isAttachment: !/.+.html?$/.test(k.attr('href')),
                isImportant: !!k.find('font').length,
              }
            })
        )
          .reduce((a, b) => a.concat(b), []).map((k, i) => {
            k.time = timeList[i]
            return k
          }))
    }
    return ret.reduce((a, b) => a.concat(b), [])
      .sort((a, b) => b.time - a.time)
      // 按保留天数和条数过滤获取的信息
      .filter((k, i) => i < keepNum || now - k.time < keepTime)
  }
}
