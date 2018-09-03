// 通过老信息门户认证，缺陷是得到的 Cookie 不能用于新信息门户
module.exports = async (ctx, cardnum, password) => {
  await ctx.get('http://myold.seu.edu.cn/login.portal')
  let res = await ctx.post('http://myold.seu.edu.cn/userPasswordValidate.portal', {
    'Login.Token1': cardnum,
    'Login.Token2': password
  })
  if (/用户不存在或密码错误/.test(res.data)) {
    throw 401
  }

  // 获取用户附加信息（仅姓名和学号）
  // 对于本科生，此页面可显示用户信息；对于其他角色（研究生和教师），此页面重定向至老信息门户主页。
  // 但对于所有角色，无论是否重定向，右上角用户姓名都可抓取；又因为只有本科生需要通过查询的方式获取学号，
  // 研究生可直接通过一卡通号截取学号，教师则无学号，所以此页面可以满足所有角色信息抓取的要求。
  res = await ctx.get('http://myold.seu.edu.cn/index.portal?.pn=p3447_p3449_p3450')

  let findName = (res) => {
    // 解析姓名
    let name = /<div style="text-align:right;margin-top:\d+px;margin-right:\d+px;color:#fff;">(.*?),/im
      .exec(res.data) || []
    return name[1] || ''
  }

  let name = findName(res)

  if (!name) {
    // 若找不到姓名，老门户三个皮肤中有一个皮肤不显示姓名，需要强行改为有姓名的皮肤
    await ctx.get('http://myold.seu.edu.cn/themeAndSkinSave.portal?themeAndSkin=default/sliver')
    // 设置皮肤后重新获取老门户页面
    res = await ctx.get('http://myold.seu.edu.cn/index.portal?.pn=p3447_p3449_p3450')
    name = findName(res)
  }

  // 初始化学号为空
  let schoolnum = ''

  // 解析学号（本科生 Only）

  if (/^21/.test(cardnum)) {
  //   schoolnum = /class="portlet-table-even">(.*)<\//im
  //   .exec(res.data) || []
  // schoolnum = schoolnum[1] || ''
  // schoolnum = schoolnum.replace(/&[0-9a-zA-Z]+;/g, '')
  // 老信息门户出现问题，从课表查询获取学号
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

  // if (/^21318/.test(cardnum)) {
  //   let res = await ctx.get('http://yx.urp.seu.edu.cn/alone.portal?.pen=pe48')
  //   schoolnum = /<th>\s*学号\s*<\/th>\s*<td>\s*([0-9A-Za-z]+)/im.exec(res.data) || []
  //   schoolnum = schoolnum[1] || ''
  // } 

  


  // 截取学号（研/博 Only）
  if (/^22/.test(cardnum)) {
    schoolnum = cardnum.slice(3)
  }

  return { name, schoolnum }
}
