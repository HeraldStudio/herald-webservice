const cheerio = require('cheerio')
const Europa = require('node-europa')
const db = require('../../database/publicity')
const url = require('url')
const moment = require('moment')

const sites = {
  jwc: {
    name: '教务处',
    codes: ['00'],
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
    name: '总务处',
    codes: ['96'],
    baseUrl: 'http://zwc.seu.edu.cn',
    infoUrl: 'http://zwc.seu.edu.cn/4297/list.htm',
    list: [['#wp_news_w3', '公告']],
    contentSelector: '[portletmode="simpleArticleContent"]' // 两个平台的正文选择器是一样的
  },
  ...require('./notice/depts.json') // FIXME 各个学院网站不能保证都能获取到通知，需要测试
}

const deptCodeFromSchoolNum = schoolnum => {
  let deptNum = schoolnum.substr(0, 2)
  return Object.keys(sites).filter(k => sites[k].codes.includes(deptNum))
}

// 根据月日，找出在今天和之前最近的符合的日期
const autoMoment = md => {
  const now = moment()
  const thisYear = now.year()
  const date = moment(`${thisYear}-${md}`)
  while (date > now) {
    date.subtract(1, 'year')
  }
  return date
}

// 有些学院网站上没有发布日期，于是使用url中的日期代替
// url 中的日期未必准确
const deduceTimeFromUrl = url => {
  let match = /\/(\d{4})\/(\d{2})(\d{2})\//.exec(url)
  if (match !== null) {
    return +moment(match[1] + '-' + match[2] + '-' + match[3])
  }
}

const commonSites = ['jwc', 'zwc']

// 5 天之内的信息，全部留下
const keepTime = +moment.duration(5, 'days')
// 10 条以内的信息，全部留下
const keepNum = 10

exports.route = {

  /**
  * GET /api/notice
  * @apiReturn [{ category, department, title, url, time, isAttachment, isImportant }]
  */
  async get () {
    let now = +moment()
    // 调试环境下接受 site 参数用于单独获取某网站的通知
    let keys = process.env.NODE_ENV === 'development'
      ? (typeof this.params.site !== 'undefined' ? [this.params.site] : commonSites)
      : commonSites

    if (this.user.isLogin
        && /^21/.test(this.user.cardnum)) { // 只处理本科生，似乎研究生从学号无法获取学院信息
      keys = keys.concat(deptCodeFromSchoolNum(this.user.schoolnum))
    }
    let ret = await Promise.all(keys.map(async (site) =>
      await this.publicCache(site, '1m+', async () => {
        if (!sites[site]) {
          throw `没有相应于 ${site} 的学校网站`
        }

        let res = await this.get(sites[site].infoUrl)

        let $ = cheerio.load(res.data)
        let list = sites[site].list

        // 分组获取时间，按组名装入 timeList 的 property 里，防止混乱
        let timeList = {}
        list.forEach(
          ele => {
            timeList[ele[1]] =
              $(ele[0]).find(sites[site].dateSelector || 'div').toArray()
              .map(k => /(\d+-)?\d+-\d+/.exec($(k).text())).filter(k => k)
              .map(k => k[1] // 有的网站上没有年份信息。
                   ? +moment(k[0])
                   : +autoMoment(k[0]))
          }
        )

        // 找出所有新闻条目，和日期配对，返回
        return list.map(ele => $(ele[0]).find('a').toArray().map(k => $(k)).map((k, i) => {
          let href = k.attr('href')
          currentUrl = url.resolve(sites[site].infoUrl, href)
          return {
            category: sites[site].name + ' - ' + ele[1],
            // 标题可能在 title 属性中，也可能并不在。
            title: k.attr('title') || k.text(),
            url: currentUrl,
            isAttachment: ! /\.(html?$|aspx?|jsp|php)/.test(href),
            isImportant: !!k.find('font').length,
            time: timeList[ele[1]][i]
              || deduceTimeFromUrl(currentUrl) // 可能网页上没有日期信息
          }
        })).reduce((a, b) => a.concat(b), [])
      }) // publicCache
    )) // Promise.all

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
      .sort((a, b) => b.time - a.time) // FIXME 改进排序，使得没有日期的项目保持稳定顺序
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
  async post ({ url, nid }) {
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
      let notice = await db.notice.find({ nid }, 1)
      return `# ${notice.title}\n\n${notice.content}`
    } else {
      throw 400
    }
  }
}
