const cheerio = require('cheerio')
const Europa = require('node-europa')
const db = require('../database/publicity')

const { sites, fetchNews } = require('./notice/func.js')
const commonSites = ['jwc', 'zwc']
// 5 天之内的信息，全部留下
const keepTime = 1000 * 60 * 60 * 24 * 5
// 10 条以内的信息，全部留下
const keepNum = 10

exports.route = {

  /**
   * GET /api/notice
   * @apiReturn [{ category, department, title, url, time, isAttachment, isImportant }]
   */
  async get () {
    let now = new Date().getTime()
    let ret = fetchNews(commonSites)
    // 小猴系统通知
    ret = ret.concat((await db.notice.find()).map(k => {
      return {
        category: '系统通知',
        department: '小猴偷米',
        title: k.title,
        nid: k.nid,
        time: k.publishTime
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
      }).convert($(typeObj.contentSelector).html())
    } else {
      return (await db.notice.find({ nid }, 1)).content
    }
  }
}
