/**
  # 用户身份认证中间件

  提供对称加密算法，把用户名密码加密保存到 sqlite 数据库，请求时用私钥解密代替用户名密码进行请求
  目的是为了给缓存和用户密码进行加密，程序只有在用户请求期间可以解密用户密码和用户数据

  ## 依赖接口

  ctx.params          from params.js
  ctx.post            from axios.js
  ctx.get             from axios.js
  ctx.cookieJar       from axios.js

  ## 暴露接口

  ctx.user.isLogin    boolean             仅已登录用户带 token 请求时有效，否则为 false
  ctx.user.encrypt    (string => string)? 使用用户 token 加密字符串，返回加密后的十六进制字符串
  ctx.user.decrypt    (string => string)? 使用用户 token 解密十六进制字符串，返回解密后的字符串
  ctx.user.token      string?             伪 token，每个用户唯一的识别码。若同一个人多处登录，该识别码不相同
  ctx.user.identity   string?             每个人唯一的识别码，若同一个人多处登录，识别码也相同。用于精确区分用户
  ctx.user.cardnum    string?             用户一卡通号码
  ctx.user.password   string?             用户密码
  ctx.user.name       string?             用户姓名
  ctx.user.schoolnum  string?             用户学号（教师为空）
  ctx.user.platform   string?             用户登录时使用的平台识别符
  ctx.useAuthCookie   (() => Promise)?    在接下来的请求中自动使用用户统一身份认证 Cookie

  注：

  以上接口除 isLogin 外，其他属性一旦被获取，将对用户进行鉴权，不允许游客使用；因此，若要定义用户和游客
  均可使用的功能，需要先通过 isLogin 区分用户和游客，然后对用户按需获取其他属性，不能对游客获取用户属性，
  否则将抛出 401。

  ## 伪 token

  对于始终需要明文用户名密码的爬虫程序来说，用户信息的安全性始终是重要话题。在爬虫程序不得不知道用户名
  和密码的情况下，我们希望尽可能缩短明文密码的生命周期，让它们只能短暂存在于爬虫程序中，然后对于上线的爬
  虫程序进行严格审查，确保明文密码没有被第三方恶意截获和存储。

  对于 token，爬虫程序其实也应当有权限获得，并用于一些自定义的加密和解密中，但相对于明文密码来说，token
  的隐私性更容易被爬虫程序开发者忽视，并可能被存入数据库作为区别用户身份的标志，从而导致潜在的隐私泄漏。
  因此，这里不向爬虫程序提供明文 token，而是只提供 token 的哈希值，仅用于区分不同用户，不用于加解密。
  对于加解密，此中间件将暴露 encrypt/decrypt 接口来帮助下游中间件加解密数据。
 */
const db = require('../database/auth')
const tough = require('tough-cookie')
const crypto = require('crypto')
const { config } = require('../app')

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

// 在这里选择认证接口提供者
const authProvider = require('./auth-provider/myold')
const graduateAuthProvider = require('./auth-provider/graduate')

// 认证接口提供者带错误处理的封装
const auth = async (ctx, cardnum, password, gpassword) => {
  try {
    if (/^22\d*(\d{6})$/.test(cardnum)) {
      await graduateAuthProvider(ctx, RegExp.$1, gpassword)
    }
    return await authProvider(ctx, cardnum, password)
  } catch (e) {
    if (e === 401) {
      if (ctx.user && ctx.user.isLogin) {
        let { token } = ctx.user
        await db.auth.remove({ tokenHash: token })
      }
    }
    throw e
  }
}

// 加密和解密过程
module.exports = async (ctx, next) => {

  // 对于 auth 路由的请求，直接截获，不交给 kf-router
  if (ctx.path === '/auth') {
    if (ctx.method.toUpperCase() !== 'POST') {
      throw 405
    }

    // 获取一卡通号、密码、研究生密码、前端定义版本
    let { cardnum, password, gpassword, platform } = ctx.params

    // 这里不用解构赋值的默认值，因为不仅需要给 undefined 设置默认值，也需要对空字符串进行容错
    gpassword = gpassword || password

    if (!platform) {
      throw '缺少参数 platform: 必须指定平台名'
    }

    // 登录统一身份认证，有三个作用：
    // 1. 验证密码正确性
    // 2. 获得统一身份认证 Cookie 以便后续请求使用
    // 3. 获得姓名和学号
    let { name, schoolnum } = await auth(ctx, cardnum, password, gpassword)

    // 生成 32 字节 token 转为十六进制，及其哈希值
    let token = new Buffer(crypto.randomBytes(32)).toString('hex')
    let tokenHash = new Buffer(crypto.createHash('md5').update(token).digest()).toString('base64')

    // 用 token 加密用户密码
    let passwordEncrypted = encrypt(token, password)

    // 对于研究生，用 token 加密研究生系统密码
    let gpasswordEncrypted = /^22/.test(cardnum) && gpassword && encrypt(token, gpassword)

    // 将新用户信息插入数据库
    let now = new Date().getTime()

    // // 同平台不允许多处登录
    // await db.auth.remove({ cardnum, platform })

    // 插入用户数据
    await db.auth.insert({
      tokenHash: tokenHash,
      cardnum,
      name,
      schoolnum,
      platform,
      password: passwordEncrypted,
      gpassword: gpasswordEncrypted,
      registered: now,
      lastInvoked: now
    })

    // 返回 token
    ctx.body = token
    return

  } else if (ctx.request.headers.token) {
    // 对于其他请求，根据 token 的哈希值取出表项
    let token = ctx.request.headers.token
    let tokenHash = new Buffer(crypto.createHash('md5').update(token).digest()).toString('base64')
    let record = await db.auth.find({ tokenHash: tokenHash }, 1)

    if (record) { // 若 token 失效，穿透到未登录的情况去
      let now = new Date().getTime()

      // 更新用户最近调用时间
      await db.auth.update({ tokenHash: tokenHash }, { lastInvoked: now })

      // 解密用户密码
      let { cardnum, password, gpassword, name, schoolnum, platform } = record

      password = decrypt(token, password)
      if (gpassword) {
        gpassword = decrypt(token, gpassword)
      }

      let identity = new Buffer(crypto.createHash('md5').update(cardnum + name).digest()).toString('base64')

      // 将统一身份认证和研究生身份认证 Cookie 获取器暴露给模块
      ctx.useAuthCookie = auth.bind(undefined, ctx, cardnum, password, gpassword)

      // 将身份识别码、解密后的一卡通号、密码和 Cookie、加解密接口暴露给下层中间件
      ctx.user = {
        isLogin: true,
        encrypt: encrypt.bind(undefined, token),
        decrypt: decrypt.bind(undefined, token),
        token: tokenHash,
        identity, cardnum, password, gpassword, name, schoolnum, platform
      }

      // 调用下游中间件
      await next()
      return
    }
  }

  // 对于没有 token 或 token 失效的请求，若下游中间件要求取 user，说明功能需要登录，抛出 401
  let reject = () => { throw 401 }
  ctx.user = {
    isLogin: false,
    get encrypt() { reject() },
    get decrypt() { reject() },
    get identity() { reject() },
    get token() { reject() },
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
