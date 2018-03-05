const cheerio = require('cheerio')
const europa = new (require('node-europa'))({
  absolute: true,
  baseUri: 'http://jwc.seu.edu.cn',
  inline: true
})

const list = [
  ['#wp_news_w5', "教务信息"],
  ['#wp_news_w6', "学籍管理"],
  ['#wp_news_w7', "实践教学"],
  ['#wp_news_w8', "国际交流"],
  ['#wp_news_w9', "教学研究"]
]

exports.route = {

  /**
   * GET /api/jwc
   * @apiReturn [{ category, title, url, time, isAttachment, isImportant }]
   */
  async get () {
    let res = await this.get('http://jwc.seu.edu.cn')
    let $ = cheerio.load(res.data)
    let now = new Date().getTime()

    let timeList = list.map(ele =>
      $(ele[0]).find('div').toArray()
        .filter(arr => /\d+-\d+-\d+/.test($(arr).text()))
        .map(item => new Date($(item).text()).getTime())
      ).reduce((a, b) => a.concat(b), [])

    return list.map(ele =>
      $(ele[0]).find('a').toArray()
        .map(k => $(k)).map(k => {
          let href = k.attr('href')
          return {
            category: ele[1],
            title: k.attr('title'),
            url: /^\//.test(href) ? 'http://jwc.seu.edu.cn' + href : href,
            isAttachment: !/.+.html?$/.test(href),
            isImportant: !!k.find('font').length,
          }
        })
      ).reduce((a, b) => a.concat(b), []).map((k, i) => {
        k.time = timeList[i]
        return k
      }).sort((a, b) => b.time - a.time)

      // 5 天内的通知全部保留，超出 5 天则只保留十条
      .filter((k, i) => i < 10 || now - k.time < 1000 * 60 * 60 * 24 * 5)
  },

  /**
   * POST /api/jwc
   * 转换教务通知内容为 Markdown
   * @apiParam url 需要转换为 Markdown 的地址
   * @apiReturn <string> 转换结果
   */
  async post () {
    let { url } = this.params
    if (!/http:\/\/jwc\.seu\.edu\.cn\//.test(url)) {
      throw 403
    }
    let { data } = await this.get(url)
    let $ = cheerio.load(data)
    return europa.convert($('[portletmode="simpleArticleContent"]').html())
  }
}
