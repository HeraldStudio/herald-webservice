/**
  # 用户身份认证中间件

  ## 交叉加密算法

  用户某平台初次登录时，为用户生成 token，与用户密码互相加密后，与两者哈希一并存入数据
  库，并将 token 明文返回给用户，服务端只保存两个密文和两个哈希，不具备解密能力；

  用户登录后，所有请求将使用 token 发起，服务端使用 token 哈希校验找到对应用户，利用
  用户提供的 token 解密用户密码，提供给路由处理程序；

  用户同一平台再次登录时，服务端使用一卡通号和平台名找到已有用户数据，通过密码哈希进行
  本地认证，认证成功则使用用户提供的密码解密原有 token，将 token 重新颁发给用户保存；
  若本地认证失败，则调用上游统一身份认证，若上游认证成功，说明密码变化，对数据库中与密码
  有关的信息进行更新。

  上述算法我们称之为交叉加密，在交叉加密下，服务端存储的隐私数据有极强的自保护性，只有
  持有用户密码和 token 之一才能解密用户隐私，而由于用户密码只有用户知道，token 只在
  用户端保存，从服务端数据库批量静态解密用户数据的风险极低。

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

// 哈希算法，用于对 token 和密码进行摘要
const hash = value => {
  return Buffer.from(crypto.createHash('md5').update(value).digest()).toString('base64')
}

// 在这里选择认证接口提供者
const authProvider = require('./auth-provider/myold')
const graduateAuthProvider = require('./auth-provider/graduate')

// 认证接口带错误处理的封装
// 此方法用于：
// - 用户首次登录；
// - 用户重复登录时，提供的密码哈希与数据库保存的值不一致；
// - 需要获取统一身份认证 Cookie (useAuthCookie()) 调用时。
const auth = async (ctx, cardnum, password, gpassword) => {
  try {
    if (/^22\d*(\d{6})$/.test(cardnum)) {
      await graduateAuthProvider(ctx, RegExp.$1, gpassword)
    }
    let { schoolnum, name } = await authProvider(ctx, cardnum, password)
    if (!schoolnum || !name) {
      throw '解析失败'
    }
    return { schoolnum, name }
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

    // POST /auth 登录认证
    if (ctx.method.toUpperCase() !== 'POST') {
      throw 405
    }

    // 获取一卡通号、密码、研究生密码、前端定义版本、自定义 token
    // 自定义 token 可用于将微信 openid 作为 token，实现微信端账号的无明文绑定
    let { cardnum, password, gpassword, platform, customToken } = ctx.params

    // 这里不用解构赋值的默认值，因为不仅需要给 undefined 设置默认值，也需要对空字符串进行容错
    gpassword = gpassword || password

    if (!platform) {
      throw '缺少参数 platform: 必须指定平台名'
    }

    // 根据用户提供的凭据，尽可能查找当前用户已认证的可解密记录，以便免去统一身份认证流程、复用已有记录
    // 无自定义 token 情况下，遵循同平台共用 token 原则，只需按平台查找用户
    // 有自定义 token 情况下，需要按自定义 token 一起查找该用户，与该 token 不一致的无法复用
    // 例如同一用户从多个微信登录，将出现同平台不同的自定 token，此时若覆盖老 token，将导致较早登录的微信被解绑 
    let criteria = { cardnum, platform }
    if (customToken) {
      criteria.tokenHash = hash(customToken)
    }
    let existing = await db.auth.find(criteria, 1)

    // 若找到已认证记录，比对密码，以便免去统一身份认证流程
    // 该过程遵循 token 不变原则，禁止覆盖原有 token，防止原有的登录会话被丢失
    if (existing) {
      let { passwordHash, gpasswordEncrypted, tokenEncrypted } = existing

      // 新认证数据库中，密码和 token 双向加密，用密码反向解密可以得到 token
      // 解密成功即可返回
      let token = decrypt(password, tokenEncrypted)
      if (token) {
        // 若两个密码有任何一个不同，可能是密码已变化，走认证
        if (passwordHash !== hash(password)
          || /^22/.test(cardnum) && gpassword !== decrypt(token, gpasswordEncrypted)) {

          await auth(ctx, cardnum, password, gpassword)

          // 未抛出异常说明新密码正确，更新数据库中密码
          // 密码变化后，密文 token、两个密文密码、密码哈希均发生变化，都要修改
          let passwordEncrypted = encrypt(token, password)
          gpasswordEncrypted = /^22/.test(cardnum) ? encrypt(token, gpassword) : ''
          tokenEncrypted = encrypt(password, token)
          passwordHash = hash(password)

          await db.auth.update({ cardnum, platform }, {
            passwordEncrypted,
            gpasswordEncrypted,
            tokenEncrypted,
            passwordHash
          })
        }

        // 若密码相同，直接通过认证，不再进行统一身份认证
        // 虽然这样可能会出现密码修改后误放行旧密码的问题，但需要 Cookie 的接口调用统一身份认证时就会 401
        ctx.body = token
        return
      }
    }

    // 无已认证记录，则登录统一身份认证，有三个作用：
    // 1. 验证密码正确性
    // 2. 获得统一身份认证 Cookie 以便后续请求使用
    // 3. 获得姓名和学号
    let { name, schoolnum } = await auth(ctx, cardnum, password, gpassword)

    // 生成 32 字节 token 转为十六进制，及其哈希值
    let token = customToken || Buffer.from(crypto.randomBytes(20)).toString('hex')
    let tokenHash = hash(token)
    let passwordHash = hash(password)

    // 若存在自定义 token，删除相同 tokenHash 的原有记录。
    // token 已存在有两种情况：
    // 1. 非自定义 token 已存在，说明当前生成的 token 与其他用户发生哈希碰撞。该情况需要 let it crash，
    //    让数据库发生插入冲突，让用户收到错误消息 400，用户再次登录将会生成新的 token，避开碰撞；
    // 2. 自定义 token（openid）已存在，说明当前微信在当前微信公众平台下已经登录了用户；又因为上面的判断
    //    已经排除了「已经登录同一用户」的情况，所以现在的情况是「当前微信在当前公众平台下已经登录其他用户」。
    //    注：微信 openid 不仅用户唯一，且平台唯一，即一个 openid 对应 (一个微信用户 × 一个平台)。
    //    这种情况下，应通过数据库删除操作将原绑定用户挤掉。
    if (customToken) {
      await db.auth.remove({ tokenHash })
    }

    // 将 token 和密码互相加密
    let tokenEncrypted = encrypt(password, token)
    let passwordEncrypted = encrypt(token, password)
    let gpasswordEncrypted = /^22/.test(cardnum) ? encrypt(token, gpassword) : ''

    // 将新用户信息插入数据库
    let now = new Date().getTime()

    // 插入用户数据
    await db.auth.insert({
      cardnum,
      tokenHash,
      tokenEncrypted,
      passwordEncrypted,
      passwordHash,
      gpasswordEncrypted,
      name, schoolnum, platform,
      registered: now,
      lastInvoked: now
    })

    // 返回 token
    ctx.body = token
    return
  } else if (ctx.request.headers.token) {
    // 对于其他请求，根据 token 的哈希值取出表项
    let token = ctx.request.headers.token
    let tokenHash = hash(token)
    let record = await db.auth.find({ tokenHash }, 1)

    if (record) { // 若 token 失效，穿透到未登录的情况去
      let now = new Date().getTime()

      // 更新用户最近调用时间
      await db.auth.update({ tokenHash }, { lastInvoked: now })

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

      // 将统一身份认证和研究生身份认证 Cookie 获取器暴露给模块
      // 在获取 Cookie 的同时，也会对密码进行统一身份认证
      // 另外还会更新用户的学号，以避免转系学生学号始终不变的问题
      ctx.useAuthCookie = async () => {
        let res = await auth(ctx, cardnum, password, gpassword)
        if (res.schoolnum !== schoolnum) {
          await db.auth.update({ tokenHash }, { schoolnum: res.schoolnum })
        }
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
    }
  }

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
