/* eslint require-atomic-updates: "off" */
const cheerio = require('cheerio')
const Europa = require('node-europa')

const loginAction = 'http://10.1.30.98:8080/competition/login.aspx'
const listUrl = 'http://10.1.30.98:8080/competition/c_stu_default.aspx'
const detailUrl = 'http://10.1.30.98:8080/competition/c_stu_xmshow.aspx?xm_bianhao='
const baseUrl = 'http://10.1.30.98:8080/competition/'

exports.route = {
  /*
    GET /api/srtp/competition
    获取竞赛列表
  */
  async get({ page = 1 }) {
    return [
      {
        id: '20200503003',
        name: '东南大学第二届在校本科生人体解剖与组胚绘图比赛',
        startTime: 1579449600000,
        endTime: 1582992000000
      }
      , {
        id: '20200301002',
        name: '第二届（2019）全国大学生 嵌入式芯片与系统设计竞赛暨全国大学生智能互联创新大赛（东部赛区）',
        startTime: 1552147200000,
        endTime: 1579017600000
      }
      , {
        id: '20200201001',
        name: '第二届（2019）全国大学生 嵌入式芯片与系统设计竞赛暨全国大学生智能互联创新大赛',
        startTime: 1569772800000,
        endTime: 1578931200000
      }
      , {
        id: '20190300192',
        name: '2019第十一届全国大学生广告艺术大赛江苏赛区竞赛',
        startTime: 1577376000000,
        endTime: 1580313600000
      }
      , {
        id: '20190200191',
        name: '2019第十一届全国大学生广告艺术大赛',
        startTime: 1577376000000,
        endTime: 1580313600000
      }
      , {
        id: '20190305190',
        name: '“互联网+”大学生创新创业大赛第五届“建行杯”国赛选拔赛暨第八届“花桥国际商务城杯”省赛',
        startTime: 1576771200000,
        endTime: 1579017600000
      }
      , {
        id: '20190205189',
        name: '第五届中国 “互联网+“大学生创新创业大赛',
        startTime: 1577203200000,
        endTime: 1579017600000
      }
      , {
        id: '20190204187',
        name: '2020年东南大学大学生英语竞赛”暨“2020年全国大学生英语竞赛初赛',
        startTime: 1577203200000,
        endTime: 1585065600000
      }
      , {
        id: '20190204186',
        name: '2019年“外研社· 国才杯”全国英语演讲 、写作 、阅读大赛',
        startTime: 1575129600000,
        endTime: 1576771200000
      }
      , {
        id: '20190101185',
        name: '第25届中国日报社“21 世纪?可口可乐杯”全国大学生英语演讲比赛江苏地区决赛',
        startTime: 1574179200000,
        endTime: 1576771200000
      }
      , {
        id: '20190304184',
        name: '第三届“卓越杯”大学生英语演讲比赛',
        startTime: 1572278400000,
        endTime: 1576771200000
      }
      , {
        id: '20190201183',
        name: '关于组织参加“第十一届中国大学生服务外包创新创业大赛”的通知',
        startTime: 1576080000000,
        endTime: 1577289600000
      }
      , {
        id: '20190301182',
        name: '2019年第九届中国教育机器人大赛江苏赛区赛',
        startTime: 1575734400000,
        endTime: 1576684800000
      }
      , {
        id: '20190301181',
        name: '江苏省第三届“构力杯”高校BIM装配式大赛',
        startTime: 1575907200000,
        endTime: 1576771200000
      }
      , {
        id: '20190201180',
        name: '全国大学生结构设计信息技术大赛',
        startTime: 1575907200000,
        endTime: 1576771200000
      }
    ]
    // SRTP 系统必须登录，但获取到的是公共数据
    // 因此，这里使用非时效性公有缓存：
    // - 若用户已登录，将根据缓存时效性选择取缓存或者帮助更新缓存；
    // - 若用户未登录，回源函数将抛出 401，根据非时效性缓存机制，将会强制取缓存。
    return await this.publicCache('1h+', async () => {
      // 模拟登录,使用管理员的一卡通以及密码
      let { cardnum, password } = require('../../../sdk/sdk.json').admin
      let res = await this.get(loginAction)
      let $ = cheerio.load(res.data)
      let fields = {}
      $('input').toArray().map(k => $(k)).map(k => {
        fields[k.attr('name')] = k.attr('value')
      })
      // 这两个参数必须有，否则无法登录
      fields['ImageButton1.x'] = 28
      fields['ImageButton1.y'] = 1
      fields.tbname = cardnum
      fields.tbpsw = password
      res = await this.post(loginAction, fields)
      $ = cheerio.load(res.data)

      // 模拟 Post 翻到指定页面
      if (page != 1) {
        fields = {}
        $('input').toArray().map(k => $(k)).map(k => {
          fields[k.attr('name')] = k.attr('value')
        })
        fields['__EVENTTARGET'] = 'ctl00$ContentPlaceHolder1$gvleader'
        fields['__EVENTARGUMENT'] = `Page$${page}`
        res = await this.post(listUrl, fields)
        $ = cheerio.load(res.data)
      }

      // 解析该页的竞赛列表
      return $('#ctl00_ContentPlaceHolder1_gvleader > tbody > tr')
        .toArray().slice(1, -1) // 去掉标题行和分页行
        .map(tr => $(tr).find('td').toArray())
        .map(arr => arr.map(item => $(item)))
        // 每行四个格子，其中name栏还包含了对应的链接
        .map(([id, name, startTime, endTime]) => ({
          id: id.text().trim(),
          name: name.text().trim(),
          startTime: +moment(startTime.text().trim(), 'YYYY-M-D H:mm:ss'),
          endTime: +moment(endTime.text().trim(), 'YYYY-M-D H:mm:ss')
        }))
    })
  },

  /*
    POST /api/srtp/competition
    解析竞赛详情
  */
  async post({ id }) {
    // 原理同上
    let { cardnum, password } = require('../../../sdk/sdk.json').admin
    let res = await this.get(loginAction)
    let $ = cheerio.load(res.data)
    let fields = {}
    $('input').toArray().map(k => $(k)).map(k => {
      fields[k.attr('name')] = k.attr('value')
    })
    // 这两个参数必须有，否则无法登录
    fields['ImageButton1.x'] = 28
    fields['ImageButton1.y'] = 1

    fields.tbname = cardnum
    fields.tbpsw = password
    await this.post(loginAction, fields)
    res = await this.get(detailUrl + id)
    $ = cheerio.load(res.data)
    let content = $('.detail_body').html()
    content = content.replace(/(<\/?\s*)(table|tbody|tr)/g, '$1div')
    content = content.replace(/(<\/?\s*)(td)/g, '$1span')

    return new Europa({
      absolute: true,
      baseUri: baseUrl,
      inline: true
    }).convert(content)
  }
}
