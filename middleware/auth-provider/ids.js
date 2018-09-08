const cheerio = require('cheerio')

// 通过新信息门户认证，缺陷是请求较慢，而且验证码会有 IP 限额
module.exports = async (ctx, cardnum, password) => {
  // IDS Server 认证地址
  const url = 'https://newids.seu.edu.cn/authserver/login?goto=http://my.seu.edu.cn/index.portal'

  // Step 1：获取登录页面表单，解析隐藏值
  let res = await ctx.get(url)
  let $ = cheerio.load(res.data)
  let form = { username: cardnum, password }
  $('[tabid="01"] input[type="hidden"]').toArray().map(k => form[$(k).attr('name')] = $(k).attr('value'))

  // Step 2：隐藏值与用户名密码一同 POST
  // 这个请求其实包含三个步骤：
  // 1. IDS 服务器解析表单参数，判断用户成功登陆，并生成 Ticket 作为参数，请求前端 302 跳到新信息门户；
  // 2. 前端再次 GET 请求带 Ticket 参数的新信息门户链接；
  // 3. 新信息门户取 Ticket 参数，私下与 IDS 服务器进行验证，验证成功后向前端颁发统一身份认证 Cookie。
  // 注：
  // 1. 新信息门户的统一身份认证 Cookie 同样包含 JSESSIONID（信息门户）和 iPlanetDirectoryPro（统一认证）两个字段。
  // 2. 此请求结束后，Cookie 将保留在 CookieJar 中，可访问信息门户和校内其他各类网站功能。
  res = await ctx.post(url, form)
  if (/您提供的用户名或者密码有误/.test(res.data) || res.status === 500) {
    throw 401
  }

  // 获取用户附加信息（仅姓名和学号）
  // 对于本科生，此页面可显示用户信息；对于其他角色（研究生和教师），此页面重定向至信息门户主页。
  // 但对于所有角色，无论是否重定向，右上角用户姓名都可抓取；又因为只有本科生需要通过查询的方式获取学号，
  // 研究生可直接通过一卡通号截取学号，教师则无学号，所以此页面可以满足所有角色信息抓取的要求。
  res = await ctx.get('http://my.seu.edu.cn/index.portal?.pn=p1681')

  // 解析姓名
  let name = /欢迎您：([^<]*)/.exec(res.data) || []
  name = name[1] || ''

  // 初始化学号为空
  let schoolnum = ''

  // 解析学号（本科生 Only）
  if (/^21/.test(cardnum)) {

    /*******************************
     * 学号获取改为从课表获取
     ******************************/
    // let infoUrl = /(pnull\.portal\?[^"]*)/.exec(res.data) || []
    // infoUrl = infoUrl[1] || ''
    // if (infoUrl) {
    //   let res = await ctx.post('http://my.seu.edu.cn/' + infoUrl, 'itemId=239&childId=241')
    //   schoolnum = /<th>\s*学籍号\s*<\/th>\s*<td colspan="1">\s*(\d+)\s*<\/td>/im.exec(res.data) || []
    //   schoolnum = schoolnum[1] || ''
    // }
    let schoolNumRes = await ctx.post(
      'http://xk.urp.seu.edu.cn/jw_service/service/stuCurriculum.action',
      {
        queryStudentId: cardnum,
        queryAcademicYear: undefined
      }
    )
    schoolnum = /学号:([0-9A-Za-z]+)/im.exec(schoolNumRes.data) || []
    schoolnum = schoolnum[1] || ''
  }

  // 截取学号（研/博 Only）
  if (/^22/.test(cardnum)) {
    schoolnum = cardnum.slice(3)
  }

  return { name, schoolnum }
}
