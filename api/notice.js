const cheerio = require('cheerio')
const Europa = require('node-europa')
const db = require('../database/publicity')

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
    ],
    contentSelector: '[portletmode="simpleArticleContent"]'
  },
  zwc: {
    baseUrl: 'http://zwc.seu.edu.cn',
    infoUrl: 'http://zwc.seu.edu.cn/4297/list.htm',
    list: [['#wp_news_w3', '总务处公告']],
    contentSelector: '[portletmode="simpleArticleContent"]' // 两个平台的正文选择器是一样的
  },
}
// 5 天之内的信息，全部留下
const keepTime = 1000 * 60 * 60 * 24 * 5
// 10 条以内的信息，全部留下
const keepNum = 10

exports.route = {

  /**
   * GET /api/notice
   * @apiReturn [{ category, title, url, time, isAttachment, isImportant }]
   */
  async get () {
    let now = new Date().getTime()
    let ret = []
    for (const site of Object.keys(sites)) {
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
        ).reduce((a, b) => a.concat(b), []).map((k, i) => {
          k.time = timeList[i]
          return k
        }))
    }

    // 小猴系统通知
    ret = ret.concat((await db.notice.find()).map(k => {
      return {
        category: '小猴通知',
        title: k.title,
        nid: k.nid,
        time: k.publishTime,
        isImportant: true
      }
    }))

    return ret.reduce((a, b) => a.concat(b), [])
      .sort((a, b) => b.time - a.time)
      // 按保留天数和条数过滤获取的信息
      .filter((k, i) => i < keepNum || now - k.time < keepTime)
  },

  /**
   * POST /api/notice
   * 转换学校通知为 Markdown，或获取系统通知 Markdown
   * @apiParam url? 需要转换为 Markdown 的地址
   * @apiParam nid? 需要查看 Markdown 的通知 nid
   * @apiReturn <string> 转换结果
   */
  async post () {
    let { url, nid } = this.params
    if (url) {
      let typeObj = Object.keys(sites).map(k => sites[k]).find(k => url.indexOf(k.baseUrl) + 1)

      // 不包含在白名单中的网站不予处理
      if (!typeObj) {
        throw 403
      }

      let { data } = await this.get(url)
      let $ = cheerio.load(data)
      return new Europa({
        absolute: true,
        baseUri: typeObj.baseUrl,
        inline: true
      }).convert($(typeObj.contentSelector).html()).replace(/\*\*/g, ' ** ')
    } else if (nid) {
      return (await db.notice.find({ nid }, 1)).content
    } else {
      throw 400
    }
  }
}
