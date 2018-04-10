const cheerio = require('cheerio')
const Europa = require('node-europa')
const db = require('../../database/publicity')

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
    // 调试环境下接受 site 参数用于单独获取某网站的通知
    let keys = process.env.NODE_ENV === 'development'
      ? (typeof this.params.site !== 'undefined' ? [this.params.site] : commonSites)
      : commonSites

    if (this.user.isLogin) { keys = keys.concat(deptCodeFromSchoolNum(this.user.schoolnum)) }
    let ret = await Promise.all(keys.map(async (site) =>
      await this.publicCache(site, '1m+', async () => {
        if (!sites[site]) {
          throw `没有相应于 ${site} 的学校网站`
        }

        let res = await this.get(sites[site].infoUrl)
        let $ = cheerio.load(res.data)
        let list = sites[site].list

        let timeList = list.map(
          ele =>
            $(ele[0]).find(sites[site].dateSelector || 'div').toArray()
            .filter(arr => /\d+-\d+-\d+/.test($(arr).text()))
            .map(item => new Date($(item).text()).getTime())
        ).reduce((a, b) => a.concat(b), [])

        // 当前页面的目录
        const infoUrlDir = /^(https?:\/\/(.+\/|[^\/]+$))[^\/]*$/.exec(sites[site].infoUrl)[1]

        return list.map(ele => $(ele[0]).find('a').toArray().map(k => $(k)).map(k => {
          let href = k.attr('href')
            return {
              category: sites[site].name + ' - ' + ele[1],
              // department: sites[site].name,
              title: k.attr('title') || k.text(),
              url: /^\//.test(href)
                ? sites[site].baseUrl + href // 绝对路径
                : (/^(https?|ftp):\/\//.test(href)
                   ? href // 带了域名的路径
                   : infoUrlDir + href // 相对路径
                  ),
              isAttachment: ! /\.(html?$|asp|php)/.test(k.attr('href')),
              isImportant: !!k.find('font').length,
            }
          })).reduce((a, b) => a.concat(b), []).map((k, i) => {
            k.time = timeList[i]
            if (! k.time) {
              // 有些学院网站上没有发布日期，于是使用url中的日期代替
              // url 中的日期未必准确
              let match = /\/(\d{4})\/(\d{2})(\d{2})\//.exec(k.url)
              if (match !== null) {
                k.time = new Date(match[1] + '-' + match[2] + '-' + match[3]).getTime()
              }
            }
            return k
          })
      }) // publicCache
    )) // Promise.all

    // 小猴系统通知
    ret = ret.concat((await db.notice.find()).map(k => {
      return {
        category: '小猴通知',
        // department: '小猴偷米',
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
