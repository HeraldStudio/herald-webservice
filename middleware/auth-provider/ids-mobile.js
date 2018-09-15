// 通过东大 App 认证，缺陷是得到的 Cookie 不能用于新信息门户，且不适用于外籍学生
module.exports = async (ctx, cardnum, password) => {
  try {
    let res = await ctx.post(
      'http://mobile4.seu.edu.cn/_ids_mobile/login18_9',
      { username: cardnum, password }
    )
    let cookie = res.headers['set-cookie']
    if (Array.isArray(cookie)) {
      cookie = cookie.filter(k => k.indexOf('JSESSIONID') + 1)[0]
    }
    cookie = /(JSESSIONID=[0-9A-F]+)\s*[;$]/.exec(cookie)[1]

    let url = 'http://www.seu.edu.cn'
    let { cookieName, cookieValue } = JSON.parse(res.headers.ssocookie)[0]
    ctx.cookieJar.setCookieSync(`${cookieName}=${cookieValue}; Domain=.seu.edu.cn`, url, {})
    ctx.cookieJar.setCookieSync(`${cookie}; Domain=.seu.edu.cn`, url, {})

    // 获取用户附加信息（仅姓名和学号）
    // 对于本科生，此页面可显示用户信息；对于其他角色（研究生和教师），此页面重定向至老信息门户主页。
    // 但对于所有角色，无论是否重定向，右上角用户姓名都可抓取；又因为只有本科生需要通过查询的方式获取学号，
    // 研究生可直接通过一卡通号截取学号，教师则无学号，所以此页面可以满足所有角色信息抓取的要求。
    res = await ctx.get('http://myold.seu.edu.cn/index.portal?.pn=p3447_p3449_p3450')

    // 解析姓名
    let name = /<div style="text-align:right;margin-top:\d+px;margin-right:\d+px;color:#fff;">(.*?),/im
      .exec(res.data) || []
    name = name[1] || ''

    // 初始化学号为空
    let schoolnum = ''

    // 解析学号（本科生 Only）
    if (/^21/.test(cardnum)) {
      schoolnum = /class="portlet-table-even">(.*)<\//im
        .exec(res.data) || []
      schoolnum = schoolnum[1] || ''
      schoolnum = schoolnum.replace(/&[0-9a-zA-Z]+;/g, '')
    }

    // 截取学号（研/博 Only）
    if (/^22/.test(cardnum)) {
      schoolnum = cardnum.slice(3)
    }

    return { name, schoolnum }
  } catch (e) {
    // 当统一身份认证请求抛出 401 时，认为登陆过期，抛出 401
    if (e.response && e.response.status === 401) {
      throw 401
    } else {
      throw e
    }
  }
}
