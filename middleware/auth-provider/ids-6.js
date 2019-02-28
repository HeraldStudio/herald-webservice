const cheerio = require('cheerio')
const mongodb = require('../../database/mongodb');

// 模拟新信息门户 (ids6) 认证，缺陷是请求较慢，而且同一个用户多次输错密码会对该用户触发验证码
module.exports = async (ctx, cardnum, password) => {
  // 检查是否需要验证码
  let now = +moment()
  let needCaptchaUrl = `https://newids.seu.edu.cn/authserver/needCaptcha.html?username=${cardnum}&pwdEncrypt2=pwdEncryptSalt&_=${now}`
  let res = await ctx.get(needCaptchaUrl)
  if(res.data){
    throw '验证码'
  }
  // IDS Server 认证地址
  const url = 'https://newids.seu.edu.cn/authserver/login?goto=http://my.seu.edu.cn/index.portal'

  // Step 1：获取登录页面表单，解析隐藏值
  res = await ctx.get(url)
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
  // 解析学号（本科生 Only）

  if (/^21/.test(cardnum)) {
    /**
     * 关于学号和姓名的更新策略
     * 
     * 使用ids6进行认证后，可以直接从网上办事大厅接口获取学号/姓名信息
     * 该方案能稳定获取但是速度较慢
     * 使用herald_userInfo集合进行缓存，更新粒度为2周
     */
    
    let userInfoCollection = await mongodb('herald_userInfo')
    let record = await userInfoCollection.findOne({cardnum})
    let now = +moment()
    try {
      if (!record || 
        (record && now - record.updateTime > 90 * 24 * 60 * 60 * 1000)) {
        // 记录不存在或者过期
        // 从ehall.seu.edu.cn抓取新的信息
        const ehallUrlRes = await ctx.get(`http://ehall.seu.edu.cn/appMultiGroupEntranceList?appId=4585275700341858&r_t=${Date.now()}`)
        let ehallUrl = '';
        ehallUrlRes.data && ehallUrlRes.data.data && ehallUrlRes.data.data.groupList && ehallUrlRes.data.data.groupList[0] &&
          (ehallUrl = ehallUrlRes.data.data.groupList[0].targetUrl);
        if (!ehallUrl) {
          throw 'ehall-fail';
        }
        await ctx.get(ehallUrl)
        let studentInfo = await ctx.post('http://ehall.seu.edu.cn/xsfw/sys/jbxxapp/modules/infoStudent/getStuBatchInfo.do')
        if (studentInfo && studentInfo.data && studentInfo.data.data) {
          studentInfo = studentInfo.data.data
          // 此处已对要返回的学号姓名进行赋值
          name = studentInfo.XM
          schoolnum = studentInfo.XH
          studentInfo = {
            cardnum,
            schoolnum:studentInfo.XH,
            name:studentInfo.XM,
            updateTime:now
          }
        } else {
          throw 'ehall-fail';
        }
        if(!record){
          // 若是无记录的情况，插入记录
          if(studentInfo.name && studentInfo.schoolnum) {
            await userInfoCollection.insertOne(studentInfo)
          }
        } else {
          // 更新记录
          await userInfoCollection.updateMany({cardnum}, {$set:studentInfo})
        }
      } else {
        // 记录存在且未过期，直接使用记录
        schoolnum = record.schoolnum
        name = record.name
      }
    } catch(e) {
      // 学号姓名信息更新失败
      if(e === 'ehall-fail'){
        console.log(`${cardnum} - 学号/姓名信息更新失败 - 由于ehall失效`)
        if(record){
          schoolnum = record.schoolnum
          name = record.name
          console.log(`已使用历史记录替代`)
        }
      }
    }
  }

  // 截取学号（研/博 Only）
  if (/^22/.test(cardnum)) {
    schoolnum = cardnum.slice(3)
  }

  return { name, schoolnum }
}
