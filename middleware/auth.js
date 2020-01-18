/**
  # 用户身份认证中间件

  ## 对接统一身份认证啦！
  我们终于不需要冒着巨大的（被查水表的）风险获取用户的一卡通和密码啦～
  
  ## 身份认证流程
  保持完整的前后端分离特性，同时提供灵活性。
  1. webservice 接受来自前端的 ticket 和 service，和 ids 服务器换取用户的「一卡通号」
  2. 依次从 T_BZKS 、T_YJS 、T_JZG_JBXX 表中根据一卡通号查询记录，进行完整性校验
  3. 生成 token 下发给用户，将 tokenHash = SHA256(token) 插入 H_AUTH

  ## 鉴权流程
  1. 从请求头中获取 x-api-token 字段
  2. 计算 tokenHash 并从数据库中查找记录
  3. 向下层提供信息
  
  ## 依赖接口

  ctx.params          from params.js
  ctx.get             from axios.js

  ## 暴露接口

  ctx.user.isLogin    boolean             仅已登录用户带 token 请求时有效，否则为 false
  ctx.user.tokenHash  string?             登录设备唯一识别码。若同一个用户多处登录，该识别码不相同
  ctx.user.cardnum    string?             用户一卡通号码
  ctx.user.name       string?             用户姓名
  ctx.user.schoolnum  string?             用户学号（教师为空）
  ctx.user.platform   string?             用户登录时使用的平台识别符
  
  注：

  以上接口除 isLogin 外，其他属性一旦被获取，将对用户进行鉴权，不允许游客使用；因此，若要定义用户和游客
  均可使用的功能，需要先通过 isLogin 区分用户和游客，然后对用户按需获取其他属性，不能对游客获取用户属性，
  否则将抛出 401。
 */

const crypto = require('crypto')
const xmlparser = require('fast-xml-parser')
const axios =  require('axios')
const { config } = require('../app')

const tokenHashPool = {} // 用于缓存tokenHash，防止高峰期数据库爆炸💥

// 对称加密算法，要求 value 是 String 或 Buffer，否则会报错
const encrypt = (key, value) => {
  try {
    let cipher = crypto.createCipher(config.auth.cipher, key)
    let result = cipher.update(value, 'utf8', 'hex')
    result += cipher.final('hex')
    return result
  } catch (e) {
    return ''
  }
}

// 对称解密算法，要求 value 是 String 或 Buffer，否则会报错
const decrypt = (key, value) => {
  try {
    let decipher = crypto.createDecipher(config.auth.cipher, key)
    let result = decipher.update(value, 'hex', 'utf8')
    result += decipher.final('utf8')
    return result
  } catch (e) {
    return ''
  }
}

// 哈希算法，用于对 token 进行摘要
const hash = value => {
  return Buffer.from(crypto.createHash('sha256').update(value).digest()).toString('base64')
}


module.exports = async (ctx, next) => {

  // 对于 auth 路由的请求，直接截获，不交给 kf-router
  if (ctx.path === '/auth') {

    // POST /auth 登录认证
    if (ctx.method.toUpperCase() !== 'POST') {
      throw 405
    }

    let { ticket, service, platform } = ctx.params


    // 登录是高权限操作，需要对参数类型进行检查，防止通过 Object 注入数据库
    // 例如 platform 若允许传入对象 { $neq: '' }，将会触发 Sqlongo 语法，导致在下面删除时把该用户在所有平台的记录都删掉
    if (typeof ticket !== 'string'
      || typeof service !== 'string') {
      throw '统一身份认证参数'
    }

    if (!platform) {
      throw '缺少参数 platform: 必须指定平台名'
    } else if (!/^[0-9a-z-]+$/.test(platform)) {
      throw 'platform 只能由小写字母、数字和中划线组成' // 为了美观（通神nb
    }

    let cardnum
    try {
      // 从IDS获取一卡通号
      const serviceValidateURL = `https://newids.seu.edu.cn/authserver/serviceValidate?service=${service}&ticket=${ticket}`
      const res = await axios.get(serviceValidateURL)
      const data = xmlparser.parse(res.data)['cas:serviceResponse']['cas:authenticationSuccess']['cas:attributes'];
      cardnum = data['cas:uid']
    } catch (e) {
      throw '统一身份认证过程出错'
    }

    // 从数据库查找学号、姓名
    let name, schoolnum
    if (cardnum.startsWith('21')) {
      // 本科生库
      const record = await ctx.db.execute(
        `SELECT XM, XJH FROM TOMMY.T_BZKS
        WHERE XH=:cardnum`, [cardnum]
      )
      if (record.rows.length > 0) {
        name = record.rows[0][0]
        schoolnum = record.rows[0][1]
      }
    } else if (cardnum.startsWith('22') || cardnum.startsWith('23')) {
      // 研究生库
      const record = await ctx.db.execute(
        `SELECT XM, XJH FROM TOMMY.T_YJS
        WHERE XH=:cardnum`, [cardnum]
      )
      if(record.rows.length > 0) {
        name = record.rows[0][0]
        schoolnum = record.rows[0][1]
      }
    } else if (cardnum.startsWith('10')) { 
      // 教职工库
      const record = await ctx.db.execute(
        `SELECT XM FROM TOMMY.T_JZG_JBXX
        WHERE ZGH=:cardnum`, [cardnum]
      )
      if(record.rows.length > 0) {
        name = record.rows[0][0]
      }
    }

    if (!name) {
      throw '身份完整性校验失败'
    }

    // 生成 32 字节 token 转为十六进制，及其哈希值
    let token = Buffer.from(crypto.randomBytes(20)).toString('hex')
    let tokenHash = hash(token)

    // 将新用户信息插入数据库
    let now = +moment()

    // TODO: 向数据库插入记录
    

    ctx.body = token
    ctx.logMsg = `${name} [${cardnum}] - 身份认证成功 - 登录平台 ${platform}`
    return

  } else if (ctx.request.headers['x-api-token']) {
    // 对于其他请求，根据 token 的哈希值取出表项
    let token = ctx.request.headers['x-api-token']
    let tokenHash = hash(token)
    // 第一步查内存缓存
    let record = tokenHashPool[tokenHash]

    if (!record) {
      // 缓存没有命中
      record = await authCollection.findOne({ tokenHash })
      tokenHashPool[tokenHash] = record
    }
    // 运行到此处，mongodb中应该已经包含用户记录了，之后的更新操作全部对mongodb操作
    // 缓存也一定已经包含tokenHash了
    // record必须包含姓名和学号，否则无效
    if (record && record.name && record.schoolnum) { // 若 token 失效，穿透到未登录的情况去
      let now = +moment()
      let lastInvoked = record.lastInvoked
      // 更新用户最近调用时间一天更新一次降低粒度
      if (now - lastInvoked >= 2 * 60 * 60 * 1000) {
        await authCollection.updateOne({ tokenHash }, { $set: { lastInvoked: now } })
        record.lastInvoked = now
      }
      // 解密用户密码
      let {
        cardnum, name, schoolnum, platform,
        passwordEncrypted, gpasswordEncrypted
      } = record
      let password = decrypt(token, passwordEncrypted)
      let gpassword = ''
      if (/^22/.test(cardnum)) {
        gpassword = decrypt(token, gpasswordEncrypted)
      }

      let identity = hash(cardnum + name)

      // 将统一身份认证 Cookie 获取器暴露给模块
      ctx.useAuthCookie = async () => {

        // 进行 ids6 认证，拿到 ids6 Cookie，如果密码错误，会抛出 401
        // 如果需要验证码，也转换成抛出401
        try {
          await ids6AuthCheck(ctx, cardnum, password, gpassword)
        } catch (e) {
          if (e === '验证码') {
            throw 401
          }
          throw e
        }

      }

      // 新网上办事大厅身份认证，使用时传入 AppID
      ctx.useEHallAuth = async (appId) => {
        await ctx.useAuthCookie()
        // 获取下一步操作所需的 URL
        const urlRes = await ctx.get(`http://ehall.seu.edu.cn/appMultiGroupEntranceList?appId=${appId}&r_t=${Date.now()}`)

        let url = ''
        urlRes.data && urlRes.data.data && urlRes.data.data.groupList && urlRes.data.data.groupList[0] &&
          (url = urlRes.data.data.groupList[0].targetUrl)
        if (!url)
          throw 400

        // 访问一下上述 URL ，获取名为 _WEU 的 cookie
        await ctx.get(url)
      }

      // 将身份识别码、解密后的一卡通号、密码和 Cookie、加解密接口暴露给下层中间件
      ctx.user = {
        isLogin: true,
        encrypt: encrypt.bind(undefined, password),
        decrypt: decrypt.bind(undefined, password),
        token: tokenHash,
        identity, cardnum, password, gpassword, name, schoolnum, platform
      }

      // 调用下游中间件
      await next()
      return
    } else {
      // 删除所有该token相关记录
      authCollection.deleteMany({ tokenHash })
    }
  }

  /* eslint getter-return:off */
  // 对于没有 token 或 token 失效的请求，若下游中间件要求取 user，说明功能需要登录，抛出 401
  let reject = () => { throw 401 }
  ctx.user = {
    isLogin: false,
    get encrypt() { reject() },
    get decrypt() { reject() },
    get identity() { reject() },
    get cardnum() { reject() },
    get password() { reject() },
    get gpassword() { reject() },
    get name() { reject() },
    get schoolnum() { reject() },
    get platform() { reject() }
  }

  ctx.useAuthCookie = reject

  // 调用下游中间件
  await next()
}
