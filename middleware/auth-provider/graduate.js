const cheerio = require('cheerio')

module.exports = async (ctx, schoolnum, password) => {
  let res = await ctx.get('http://121.248.63.139/nstudent/login.aspx')
  let $ = cheerio.load(res.data)
  let data = {
    'txt_user': schoolnum,
    'txt_password': password,
    'ok.x': 26,
    'ok.y': 8
  }
  $('input[name="__VIEWSTATE"]').toArray().map(k => $(k)).map(k => {
    data[k.attr('name')] = k.attr('value')
  })
  res = await ctx.post('http://121.248.63.139/nstudent/login.aspx', data)
  if (/密码错误/.test(res.data)) {
    throw 401
  }
}
