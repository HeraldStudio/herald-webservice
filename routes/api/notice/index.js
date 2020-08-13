const cheerio = require('cheerio')
const Europa = require('node-europa')
const url = require('url')

const sites = {
  jwc: {
    name: '教务处',
    codes: ['00'],
    baseUrl: 'http://jwc.seu.edu.cn',
    infoUrl: 'http://jwc.seu.edu.cn',
    list: [
      ['#wp_news_w6', '教务信息'],
      ['#wp_news_w7', '学籍管理'],
      ['#wp_news_w9', '实践教学'],
      ['#wp_news_w10', '国际交流'],
      ['#wp_news_w8', '教学研究'],
    ],
    contentSelector: '.wp_articlecontent'
  },
  zwc: {
    name: '总务处',
    codes: ['96'],
    baseUrl: 'http://zwc.seu.edu.cn',
    infoUrl: 'http://zwc.seu.edu.cn/4297/list.htm',
    list: [['#wp_news_w6', '公告']],
    contentSelector: '[portletmode="simpleArticleAttri"]', // 两个平台的正文选择器是一样的
    dateSelector: 'span.news_meta'
  },
  ...require('./depts.json') // FIXME 各个学院网站不能保证都能获取到通知，需要测试
}

const deptCodeFromSchoolNum = schoolnum => {
  let deptNum = schoolnum.substr(0, 2)
  return Object.keys(sites).filter(k => sites[k].codes.includes(deptNum))
}

// 根据月日，找出在今天和之前最近的符合的日期
const autoMoment = md => {
  const now = moment()
  const thisYear = now.year()
  const date = moment(`${thisYear}-${md}`, 'YYYY-MM-DD')
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
  return null
}

const commonSites = ['jwc', 'zwc']

// 5 天之内的信息，全部留下
const keepTime = +moment.duration(5, 'days')
// 10 条以内的信息，全部留下
const keepNum = 10
/**
 * @apiDefine notice 通知/公告
 */
exports.route = {

  /**
  * GET /api/notice
  * 调试模式下 GET /api/notice?site=zwc
  * @Return [{ category, department, title, url, time, isAttachment, isImportant }]
  * 目前没有使用缓存，但是根据时间消耗，还是应该使用缓存提升用户体验
  */
  /**
  * @api {GET} /api/notice 获取公告
  * @apiGroup notice
  */
  async get() {
    // return await this.publicCache(,'1d', async () => {
    let now = +moment()
    // 调试环境下接受 site 参数用于单独获取某网站的通知
    let argSite = program.mode === 'development' ? this.params.site : undefined
    delete this.params.site
    let keys = typeof argSite !== 'undefined' ? [argSite] : commonSites

    if (typeof argSite === 'undefined'
      && this.user.isLogin
      && /^21/.test(this.user.cardnum)) { // 只处理本科生，似乎研究生从学号无法获取学院信息
      keys = keys.concat(deptCodeFromSchoolNum(this.user.schoolnum))
    }

    let ret = await Promise.all(keys.map(async (site) =>
      await this.publicCache(site, '1m+', async () => {
        if (!sites[site]) {
          throw `没有相应于 ${site} 的学校网站`
        }

        // console.log(sites[site].infoUrl)
        let res = await this.get(sites[site].infoUrl)
        // console.log(res.data)
        let $ = cheerio.load(res.data)
        // console.log('$:',$.html())
        let list = sites[site].list

        // 分组获取时间，按组名装入 timeList 的 property 里，防止混乱
        let timeList = {}
        list.forEach(
          ele => {
            // console.log(sites[site].dateSelector)
            // console.log(ele[0])
            // console.log($('div'))
            timeList[ele[1]] =
              $(ele[0]).find(sites[site].dateSelector || 'div').toArray()
                .map(k => /(\d+-)?(\d+)-(\d+)/.exec($(k).text()))
                .filter(k => k)
                .map(k => {
                  k.year = parseInt(k[1])
                  k.month = parseInt(k[2])
                  k.date = parseInt(k[3])
                  return k
                })
                // 过滤掉一看就不是日期的内容，比如「17-18-3」
                // 一个标题: 我院召开17-18-3学期期中教学检查学生座谈会
                .map(k => {
                  if ((!k.year || k.year >= 1000 || k.year < 100)
                    && k.month >= 1 && k.month <= 12
                    && k.date >= 1 && k.date <= 31) {
                    return k
                  }
                })
                // FIXME 这里可能还存在着 bug。
                .map(k => k[1] // 有的网站上没有年份信息。
                  ? +moment(k[0], 'YYYY-MM-DD')
                  : +autoMoment(k[0]))
          }
        )
        // 找出所有新闻条目，和日期配对，返回
        return list.map(ele => $(ele[0]).find('a').toArray().map(k => $(k))
          .filter(k => k.attr('title') && k.attr('title').trim() || k.text().trim()).map((k, i) => {
            let href = k.attr('href') ? k.attr('href') : ''
            let currentUrl = url.resolve(sites[site].infoUrl, href)

            return {
              site: sites[site].name,
              category: ele[1],
              // 标题可能在 title 属性中，也可能并不在。
              title: k.attr('title') && k.attr('title').trim() || k.text().trim(),
              url: currentUrl,
              isAttachment: ! /\.(html?$|aspx?|jsp|php)/.test(href),
              isImportant: !!k.find('font').length,
              time: +moment(timeList[ele[1]][i])
                || deduceTimeFromUrl(currentUrl), // 可能网页上没有日期信息
              // 记下其在本栏中出现的顺序，一般，序号越小，越新
              index: i
            }
          }).reduce((arr, news) => { if (news.title) { arr.push(news) } return arr }, [])
        ).reduce((a, b) => a.concat(b), [])
      }) // publicCache
    )) // Promise.all
    // 小猴系统通知
    let res = []
    let hasUser = ""
    if (this.user.isLogin) {
      hasUser = `
      LEFT JOIN (
        SELECT notice, max(READTIME) READTIME
        FROM H_NOTICE_ISREAD
        WHERE CARDNUM ='${this.user.cardnum}'
        group by NOTICE
      ) HNI
      ON H_NOTICE.ID = HNI.NOTICE
      `
    }
    let noticeList = await this.db.execute(`
      SELECT ID,TITLE,URL,SCHOOLNUM_PREFIX,PUBLISH_TIME AS TIME${hasUser ? ', HNI.READTIME' : ''}
        FROM TOMMY.H_NOTICE 
        ${hasUser}
        ORDER BY PUBLISH_TIME DESC
      `)
    // 对数据查询结果格式处理
    const fieldName = noticeList.metaData.map(item => {
      if (item.name.split('_').length === 1) {
        return item.name.toLowerCase()
      } else {
        return item.name.split('_')[0].toLowerCase() +
          (item.name.split('_')[1].charAt(0).toUpperCase() + item.name.split('_')[1].slice(1).toLowerCase())
      }
    })
    const data = noticeList.rows
    data.forEach(oneData => {
      let tempData = {}
      oneData.forEach((item, index) => {
        if (index === 5 || index === 4) {
          item = +moment(item)
        }
        tempData[fieldName[index]] = item
        tempData.site = '小猴偷米'
        tempData.category = '小猴通知'
      })
      if (this.user.isLogin) {
        tempData.isRead = !!tempData.readtime
      }
      res.push(tempData)
    })
    // 按照学号前缀过滤
    res = res.filter(k => {
      if (k.schoolnumPrefix === null || !this.user.isLogin) return true
      let result = false
      const prefixList = k.schoolnumPrefix.split(' ')
      prefixList.forEach(prefix => {
        if (this.user.schoolnum.startsWith(prefix)) result = true
      })
      return result
    })


    ret = ret.reduce((a, b) => a.concat(b), [])
      // 如果项目都有两个时间，就按时间排序，否则按在某一栏中出现的顺序排序
      // 时间越大，或者序号越小，越新。
      .sort((a, b) => (a.time && b.time) ? (b.time - a.time) : (a.index - b.index))
      // 按保留天数和条数过滤获取的信息
      .filter(k => k.index < keepNum || now - k.time < keepTime)
      // 加上小猴偷米的消息通知
      .concat(res)

    // 按照标题去重
    let titleList = {}
    ret = ret.filter(k => {
      if (typeof titleList[k.title] === 'undefined') {
        titleList[k.title] = true
        return true
      } else {
        return false
      }
    })

    // return ret
    // })

  },

  /**
  * POST /api/notice
  * 转换学校通知为 Markdown，或获取系统通知 Markdown
  * @Param url? 需要转换为 Markdown 的地址
  * @Param nid? 需要查看 Markdown 的通知 nid
  * @Return <string> 转换结果
  */

  /**
  * @api {POST} /api/notice 新建公告
  * @apiGroup notice
  * 
  * @apiParam {String} url
  * @apiParam {String} id
  */
  async post({ url = '', id = '' }) {
    // 1小时的缓存
    return await this.publicCache('1d', async () => {
      if (url) {
        let typeObj = Object.keys(sites).map(k => sites[k]).find(k => url.indexOf(k.baseUrl) + 1)
        // 不包含在白名单中的网站不予处理
        if (!typeObj) {
          throw 403
        }
        let { data } = await this.get(url)
        let $ = cheerio.load(data)
        let ret = new Europa({
          absolute: true,
          baseUri: typeObj.baseUrl,
          inline: true
        }).convert($(typeObj.contentSelector || "[frag='窗口3']").html())
        return ret
      } else if (id) {
        let notice = await this.db.execute(`SELECT TITLE,CONTENT,URL FROM TOMMY.H_NOTICE WHERE ID =:id`, { id })
        if (notice.rows.length === 0) {
          throw "通知不存在"
        }
        // 若已登录则标注已读
        if (this.user.isLogin) {
          await this.db.execute(`
          INSERT INTO H_NOTICE_ISREAD (NOTICE, CARDNUM)
          VALUES (:id, :cardnum)
          `, { id, cardnum: this.user.cardnum })
        }

        // oracle 空字段返回的null 为string 类型
        // 处理一下返回数据
        let heraldNotice = {}
        heraldNotice['title'] = notice.rows[0][0]
        heraldNotice['content'] = notice.rows[0][1]
        heraldNotice['url'] = notice.rows[0][2]
        return `# ${heraldNotice.title}\n\n
                ${heraldNotice.content}\n\n 
                ${heraldNotice.url !== "null" ? '相关链接:' + heraldNotice.url : ''}
                `
      } else {
        throw '无转换结果'
      }
    })
  }
}
