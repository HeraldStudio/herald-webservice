/* eslint require-atomic-updates: "off" */
const cheerio = require('cheerio')
const Europa = require('node-europa')

const loginAction = 'http://10.1.30.98:8080/competition/login.aspx'
const listUrl = 'http://10.1.30.98:8080/competition/c_stu_default.aspx'
const detailUrl = 'http://10.1.30.98:8080/competition/c_stu_xmshow.aspx?xm_bianhao='
const baseUrl = 'http://10.1.30.98:8080/competition/'
/**
 * @apiDefine srtp srtp竞赛相关
 */
exports.route = {
  /**
  * @api {GET} /api/srtp/competition 获取竞赛列表
  * @apiGroup srtp
  * 
  * @apiParam {Number} page=1 页码
  */
  async get({ page = 1 }) {
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

  /**
  * @api {POST} /api/srtp/competition 解析竞赛详情
  * @apiGroup srtp
  * 
  * @apiParam {String} id
  */
  async post({ id }) {
    // 获取notice详情出错建的东墙，以后记得拆
    let notice = await this.db.execute(`SELECT TITLE,CONTENT,URL FROM TOMMY.H_NOTICE WHERE ID =:id`, { id })
    if (notice.rows.length > 0) {
      // oracle 空字段返回的null 为string 类型
      // 处理一下返回数据
      let heraldNotice = {}
      heraldNotice['title'] = notice.rows[0][0]
      heraldNotice['content'] = notice.rows[0][1]
      heraldNotice['url'] = notice.rows[0][2]

      return `# ${heraldNotice.title}\n\n
        ${heraldNotice.content}\n\n 
        ${heraldNotice.url !== null ? '相关链接:' + heraldNotice.url : ''}`
    }

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
