const cheerio = require('cheerio')

const loginAction = 'http://10.1.30.98:8080/competition/login.aspx'
const listUrl = 'http://10.1.30.98:8080/competition/c_stu_default.aspx'
const url = require('url')

exports.route = {
  /*
    GET api/srtp/competition
    获取竞赛列表
  */
  async get() {
    // FIXME 理论上来说每个人获取到的内容应该都是一样的，
    // 但是这个网页必须登录
    return await this.userCache('5m+', async () => {
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
          url: url.resolve(listUrl, name.find('a').attr('href')),
          startTime: +moment(startTime.text().trim()),
          endTime: +moment(endTime.text().trim())
        }))
    })
  }
}
