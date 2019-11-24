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
  ctx.useEHallAuth  ((appId) => Promise)? 使用AppID获取新网上办事大厅的身份认证凭据
  
  注：

  以上接口除 isLogin 外，其他属性一旦被获取，将对用户进行鉴权，不允许游客使用；因此，若要定义用户和游客
  均可使用的功能，需要先通过 isLogin 区分用户和游客，然后对用户按需获取其他属性，不能对游客获取用户属性，
  否则将抛出 401。
 */
// const tough = require('tough-cookie')
const crypto = require('crypto')
const { config } = require('../app')
const mongodb = require('../database/mongodb')

const tokenHashPool = {} // 用于缓存tokenHash，防止高峰期数据库爆炸💥
// 数据库迁移代码
// (async() => {
//   console.log('正在迁移auth数据库')
//   let allUsers = await db.auth.find({}, -1)
//   let authCollection = await mongodb('herald_auth')
//   if (allUsers.length > 0) {
//   await authCollection.insertMany(allUsers)
//   }
//   console.log(`共迁移${allUsers.length}条记录`)
// })();

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

/**
 * 现在需要同时集成三种认证通道
 * ids3 是模拟老信息门户 + 东大 App 认证，速度快，不会出验证码，但得到的 Cookie 适用范围不大
 * ids6 是模拟新信息门户认证，速度慢，多次输错密码会对该用户出现验证码，得到的 Cookie 适用范围广
 * 因此使用 ids3 作为登录校验，校验通过后，如果路由处理程序需要 ids6 Cookie，则走一遍 ids6
 * 
 * 具体：
 * 1. 登录认证 => ids3 => 登录成功
 * 2. 路由请求 => 路由需要 ids3 Cookie? => ids3 => 路由需要 ids6 Cookie? => ids6
 */
// const ids3Auth = require('./auth-provider/ids-3')
const ids6Auth = require('./auth-provider/ids-6')
const graduateAuth = require('./auth-provider/graduate')

// 认证接口带错误处理的封装
// 此方法用于：
// - 用户首次登录；
// - 用户重复登录时，提供的密码哈希与数据库保存的值不一致；
// - 需要获取 ids3 Cookie (useAuthCookie()) 调用时。
// const ids3AuthCheck = async (ctx, cardnum, password, gpassword) => {
//   try {
//     if (/^22\d*(\d{6})$/.test(cardnum)) {
//       await graduateAuth(ctx, RegExp.$1, gpassword)
//     }
//     let { schoolnum, name } = await ids3Auth(ctx, cardnum, password)
//     if (!schoolnum || !name) {
//       throw '身份完整性校验失败'
//     }
//     return { schoolnum, name }
//   } catch (e) {
//     if (e === 401) {
//       if (ctx.user && ctx.user.isLogin) {
//         let authCollection = await mongodb('herald_auth')
//         let { token } = ctx.user
//         await authCollection.deleteMany({ tokenHash: token })
//         tokenHashPool[token] = undefined
//       }
//     }
//     throw e
//   }
// }

const ids6AuthCheck = async (ctx, cardnum, password, gpassword) => {
  try {
    if (/^22\d*(\d{6})$/.test(cardnum)) {
      await graduateAuth(ctx, RegExp.$1, gpassword)
    }
    let { schoolnum, name } = await ids6Auth(ctx, cardnum, password)
    if (!schoolnum || !name) {
      throw '身份完整性校验失败'
    }
    return { schoolnum, name }
  } catch (e) {
    if (e === 401 || e === '验证码') {
      if (ctx.user && ctx.user.isLogin) {
        let authCollection = await mongodb('herald_auth')
        let { token } = ctx.user
        await authCollection.deleteMany({ tokenHash: token })
        tokenHashPool[token] = undefined
      }
    }
    throw e
  }
}
let passwordProtect = {

}
// 加密和解密过程
module.exports = async (ctx, next) => {
  let authCollection = await mongodb('herald_auth')
  // 对于 auth 路由的请求，直接截获，不交给 kf-router
  if (ctx.path === '/auth') {

    // POST /auth 登录认证
    if (ctx.method.toUpperCase() !== 'POST') {
      throw 405
    }

    // 获取一卡通号、密码、研究生密码、前端定义版本、自定义 token
    // 自定义 token 可用于将微信 openid 作为 token，实现微信端账号的无明文绑定
    let { cardnum, password, gpassword, platform, customToken } = ctx.params

    let weakHash = hash(password)
    if(!passwordProtect[weakHash]){
      passwordProtect[weakHash] = [cardnum]
    } else {
      if(passwordProtect[weakHash].indexOf(cardnum) === -1){
        passwordProtect[weakHash].push(cardnum)
      }
      if(passwordProtect[weakHash].length >= 50) {
        console.log(`触发弱密码保护 ${cardnum} ${password}`)
        throw '出于安全考虑，禁止弱密码登录'
      }
    }
    // 登录是高权限操作，需要对参数类型进行检查，防止通过 Object 注入数据库
    // 例如 platform 若允许传入对象 { $neq: '' }，将会触发 Sqlongo 语法，导致在下面删除时把该用户在所有平台的记录都删掉
    if (typeof cardnum !== 'string'
      || typeof password !== 'string'
      || typeof platform !== 'string'
      || typeof gpassword !== 'string' && typeof gpassword !== 'undefined'
      || typeof customToken !== 'string' && typeof customToken !== 'undefined')

      // 这里不用解构赋值的默认值，因为不仅需要给 undefined 设置默认值，也需要对空字符串进行容错
      gpassword = gpassword || password

    if (!platform) {
      throw '缺少参数 platform: 必须指定平台名'
    } else if (!/^[0-9a-z-]+$/.test(platform)) {
      throw 'platform 只能由小写字母、数字和中划线组成' // 为了美观
    }

    let needCaptchaUrl = `https://newids.seu.edu.cn/authserver/needCaptcha.html?username=${cardnum}&pwdEncrypt2=pwdEncryptSalt&_=${+moment()}`
    let captchaRes = await ctx.get(needCaptchaUrl)
    let needCaptcha = captchaRes.data

    if(needCaptcha){
      // 需要验证码
      let verifyUrl = `https://newids.seu.edu.cn/authserver/logout?service=http://auth.myseu.cn/prepare/${platform}`
      ctx.status = 303
      ctx.body = {
        verifyUrl
      }
      return // 都出验证码了，还要啥自行车啊，直接返回就行了
    }
    // 无自定义 token 情况下，遵循同平台共用 token 原则，需按平台查找用户，从而尽可能查找已认证记录，免去认证流程
    // 有自定义 token 情况下，需要按自定义 token 查找该用户，与该 token 不一致的无法复用
    // 这里的 criteria 不仅表示查找的条件，同时也是找到记录但需要删除旧记录时的删除条件，修改时请考虑下面删除的条件
    let criteria = customToken ? { tokenHash: hash(customToken) } : { cardnum, platform, pending:false }

    // mongodb迁移
    let existing = await authCollection.findOne(criteria)

    // 若找到已认证记录，比对密码，全部正确则可以免去统一身份认证流程，确认不需要验证码
    if (existing) {
      let { passwordHash, tokenEncrypted, gpasswordEncrypted } = existing
      let token
      // 先判断密码正确
      if (hash(password) === passwordHash
        // 然后用密码解密 tokenEncrypted 得到 token，判断 token 有效
        && (token = decrypt(password, tokenEncrypted))
        // 如果是研究生，再用 token 解密研究生密码，判断研究生密码不变
        && (!/^22/.test(cardnum) || gpassword === decrypt(token, gpasswordEncrypted))) {
        // 所有条件满足，直接通过认证，不再走统一身份认证接口
        // 虽然这样可能会出现密码修改后误放行旧密码的问题，但之后使用中迟早会 401（取统一身份认证 Cookie 时密码错误会发生 401）
        ctx.body = token
        ctx.logMsg = `${cardnum} - 身份认证成功 - 登录平台 ${platform}`
        return
      }

      // 运行到此说明数据库中存在记录，但密码与数据库中密码不一致，有两种情况：
      // 1. 数据库中密码是正确的，但用户密码输错；
      // 2. 用户改了密码，数据库中密码不是最新。
      // 3. 用户需要验证码
      // 这两种情况统一穿透到下面进行，如果认证通过，说明是第二种情况，则会删除数据库已有记录。
    }

    let name, schoolnum

    // 登录信息门户认证，用于验证密码正确性、并同时获得姓名和学号
    let idsResult = await ids6AuthCheck(ctx, cardnum, password, gpassword)
    name = idsResult.name
    schoolnum = idsResult.schoolnum

    // 生成 32 字节 token 转为十六进制，及其哈希值
    let token = customToken || Buffer.from(crypto.randomBytes(20)).toString('hex')
    let tokenHash = hash(token)
    let passwordHash = hash(password)

    // 认证通过，如果存在已有记录：
    // 1. 如果是自定义 token（例如微信端），说明使用该 token（微信号）的用户想绑定新用户，需要删除旧记录
    // 2. 如果是非自定义 token，说明新旧密码不同，且新密码正确，说明用户改了密码，此时为了信息安全，也需要删除所有旧记录
    if (existing) {
      // 这里 criteria 跟查找时的条件相同，自定义 token 按 tokenHash 删除，否则按一卡通号和平台删除
      await authCollection.deleteMany(criteria)
      tokenHashPool[tokenHash] = undefined
    }

    // 将 token 和密码互相加密
    let tokenEncrypted = encrypt(password, token)
    let passwordEncrypted = encrypt(token, password)
    let gpasswordEncrypted = /^22/.test(cardnum) ? encrypt(token, gpassword) : ''

    // 将新用户信息插入数据库
    let now = +moment()

    // 不再向老数据库插入记录，所有记录都插入新数据库
    await authCollection.insertOne({
      cardnum,
      tokenHash,
      tokenEncrypted,
      passwordEncrypted,
      passwordHash,
      gpasswordEncrypted,
      name, schoolnum, platform,
      registered: now,
      lastInvoked: now,
    })

    ctx.body = token
    ctx.logMsg = `${name} [${cardnum}] - 身份认证成功 - 登录平台 ${platform}`
    return
  
  } else if (ctx.request.headers.token) {
    // 对于其他请求，根据 token 的哈希值取出表项
    let token = ctx.request.headers.token
    let tokenHash = hash(token)
    // 第一步查缓存
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
        } catch(e) {
          if(e === '验证码'){
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
      authCollection.deleteMany({tokenHash})
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
