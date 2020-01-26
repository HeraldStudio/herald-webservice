const cheerio = require('cheerio')
const Europa = require('node-europa')
const mongodb = require('../../../database/mongodb')
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
      ['#wp_news_w11','文化素质教育']
    ],
    contentSelector: '.wp_articlecontent'
  },
  zwc: {
    name: '总务处',
    codes: ['96'],
    baseUrl: 'http://zwc.seu.edu.cn',
    infoUrl: 'http://zwc.seu.edu.cn/4297/list.htm',
    list: [['#wp_news_w6', '公告']],
    contentSelector: '[portletmode="simpleArticleContent"]', // 两个平台的正文选择器是一样的
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

exports.route = {

  /**
  * GET /api/notice
  * 调试模式下 GET /api/notice?site=zwc
  * @apiReturn [{ category, department, title, url, time, isAttachment, isImportant }]
  * 目前没有使用缓存，但是根据时间消耗，还是应该使用缓存提升用户体验
  */
  async get () {
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
    {
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
                .filter(k =>
                  (!k.year || k.year >= 1000 || k.year < 100)
                      && k.month >= 1 && k.month <= 12
                      && k.date >= 1 && k.date <= 31)
              // FIXME 这里可能还存在着 bug。
                .map(k => k[1] // 有的网站上没有年份信息。
                  ? +moment(k[0], 'YYYY-MM-DD')
                  : +autoMoment(k[0]))
        }
      )
      // console.log(timeList)

      // 找出所有新闻条目，和日期配对，返回
      return list.map(ele => $(ele[0]).find('a').toArray().map(k => $(k)).map((k, i) => {
        let href = k.attr('href') ? k.attr('href'):''
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
      }).reduce((arr, news) => {if(news.title){arr.push(news)} return arr}, [])
      ).reduce((a, b) => a.concat(b), [])
    } 
    )) // Promise.all

    // 小猴系统通知
    let res = []
    let noticeList = await this.db.execute(`
    SELECT ID,TITLE,CONTENT,URL,SCHOOLNUM_PREFIX,PUBLISH_TIME AS TIME
      FROM TOMMY.H_NOTICE ORDER BY PUBLISH_TIME DESC
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
        if (index === 5 ) {
          item = moment(item).format('YYYY-MM-DD')
        }
        tempData[fieldName[index]] = item
        tempData.site = '小猴偷米'
        tempData.category = '小猴通知'
      })
      res.push(tempData)
    })
    // 按照学号前缀过滤
    res = res.filter(k => {
      if (k.schoolnumPrefix === null || !this.user.isLogin) return true
      let result = false
      const prefixList = k.schoolnumPrefix.split(' ')
      prefixList.forEach( prefix => {
        if(this.user.schoolnum.startsWith(prefix)) result =true
      })
      return result
    })
    

    ret = ret.reduce((a, b) => a.concat(b), [])
      // 如果项目都有两个时间，就按时间排序，否则按在某一栏中出现的顺序排序
      // 时间越大，或者序号越小，越新。
      .sort((a, b) => (a.time && b.time) ? (b.time - a.time) : (a.index - b.index))
      // 按保留天数和条数过滤获取的信息
      .filter(k => k.index < keepNum || now - k.time < keepTime)
      // 修改一下时间格式
      .map(k => {
        k.time = moment(k.time).format('YYYY-MM-DD')
        return k
      })
      // 加上小猴偷米的消息通知
      .concat(res)

    // 按照标题去重
    let titleList = {}
    ret = ret.filter( k => {
      if (typeof titleList[k.title] === 'undefined'){
        titleList[k.title] = true
        return true
      } else {
        return false
      }
    })

    return ret
  },

  /**
  * POST /api/notice
  * 转换学校通知为 Markdown，或获取系统通知 Markdown
  * @apiParam url? 需要转换为 Markdown 的地址
  * @apiParam nid? 需要查看 Markdown 的通知 nid
  * @apiReturn <string> 转换结果
  */
  async post ({ url = '', nid = '' }) {
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
      }).convert($(typeObj.contentSelector || 'body').html())
    } else if (nid) {
      let noticeCollection = await mongodb('herald_notice')
      //let notice = await db.notice.find({ nid }, 1)
      let notice = await noticeCollection.findOne({ nid })
      return `# ${notice.title}\n\n${notice.content}`
    } else {
      throw '无转换结果'
    }
  }
}
