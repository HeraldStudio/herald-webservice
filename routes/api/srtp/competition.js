const cheerio = require('cheerio')
const Europa = require('node-europa')

const loginAction = 'http://10.1.30.98:8080/competition/login.aspx'
const detailUrl = 'http://10.1.30.98:8080/competition/c_stu_xmshow.aspx?xm_bianhao='
const baseUrl = 'http://10.1.30.98:8080/competition/'
const url = require('url')

exports.route = {
  /*
    GET /api/srtp/competition
    获取竞赛列表
  */
  async get() {
    // SRTP 系统必须登录，但获取到的是公共数据
    // 因此，这里使用非时效性公有缓存：
    // - 若用户已登录，将根据缓存时效性选择取缓存或者帮助更新缓存；
    // - 若用户未登录，回源函数将抛出 401，根据非时效性缓存机制，将会强制取缓存。
    return await this.publicCache('1h+', async () => {
      let { cardnum, password } = this.user
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
      return $('#ctl00_ContentPlaceHolder1_gvleader > tbody > tr')
        .toArray().slice(1, -1) // 去掉标题行和分页行
        .map(tr => $(tr).find('td').toArray())
        .map(arr => arr.map(item => $(item)))
        // 每行四个格子，其中name栏还包含了对应的链接
        .map(([id, name, startTime, endTime]) => ({
          id: id.text().trim(),
          name: name.text().trim(),
          startTime: +moment(startTime.text().trim()),
          endTime: +moment(endTime.text().trim())
        }))
    })
  },

  /*
    POST /api/srtp/competition
    解析竞赛详情
  */
  async post({ id }) {
    // 原理同上
    return await this.publicCache('5m+', async () => {
      let { cardnum, password } = this.user
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
      content = content.replace(/(<\/?\s*)(td\s+class="tbtitle")/g, '$1h2')
      content = content.replace(/(<\/?\s*)(td)/g, '$1p')

      return new Europa({
        absolute: true,
        baseUri: baseUrl,
        inline: true
      }).convert(content).replace(/\*\*/g, ' ** ')
    })
  }
}
