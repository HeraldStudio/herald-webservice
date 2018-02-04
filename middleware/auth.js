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
  ctx.user.token      string?             伪 token，不能用于加解密，只用于区分用户
  ctx.user.cardnum    string?             用户一卡通号码
  ctx.user.password   string?             用户密码
  ctx.user.name       string?             用户姓名
  ctx.user.schoolnum  string?             用户学号（教师为空）
  ctx.user.cookie     string?             用户统一身份认证 Cookie
  ctx.useCookie       (() => ())?         在接下来的请求中自动使用用户统一身份认证 Cookie

  注：

  以上接口除 isLogin 外，其他属性一旦被获取，将对用户进行鉴权，不允许游客使用；因此，若要定义用户和游客
  均可使用的功能，需要先通过 isLogin 区分用户和游客，然后对用户按需获取其他属性，不能对游客获取用户属性，
  否则将抛出 401。

  ## 伪 token

  对于始终需要明文用户名密码的爬虫程序来说，用户信息的安全性始终是重要话题。在爬虫程序不得不知道用户名
  和密码的情况下，我们希望尽可能缩短明文密码和明文 Cookie 的生命周期，让它们只能短暂存在于爬虫程序中，
  然后对于上线的爬虫程序进行严格审查，确保明文密码和明文 Cookie 没有被第三方恶意截获和存储。

  对于 token，爬虫程序其实也应当有权限获得，并用于一些自定义的加密和解密中，但相对于明文密码和明文 Coo-
  kie 来说，token 的隐私性更容易被爬虫程序开发者忽视，并可能被存入数据库作为区别用户身份的标志，从而导
  致潜在的隐私泄漏。因此，这里不向爬虫程序提供明文 token，而是只提供 token 的哈希值，仅用于区分不同用
  户，不用于加解密。对于加解密，此中间件将暴露 encrypt/decrypt 接口来帮助下游中间件加解密数据。
 */
const { Database } = require('sqlite3')
const db = new Database('auth.db')
const config = require('../config.json')
const crypto = require('crypto')
const tough = require('tough-cookie')

// 对 Database 异步函数进行 async 封装
;['run', 'get', 'all'].map (k => {
  [db['_' + k], db[k]] = [db[k], (sql, param) => new Promise((resolve, reject) => {
    db['_' + k](sql, param || [], (err, res) => {
      err ? reject(err) : resolve(res)
    })
  })]
})

/**
  ## auth 数据表结构

  token_hash    varchar  令牌哈希值 = Base64(MD5(token))，用于根据私钥找到用户
  cardnum       varchar  一卡通号
  password      varchar  密文密码 = Base64(MD5(cipher(token, 明文密码)))
  name          varchar  姓名
  schoolnum     varchar  学号（教师为空）
  cookie        varchar  密文统一身份认证 Cookie = Base64(MD5(cipher(token, 明文统一身份认证 Cookie)))
  version_desc  varchar  版本备注，由调用端任意指定
  registered    integer  认证时间
  last_invoked  integer  上次使用时间，超过一定设定值的会被清理
 */
;(async () => {

  // 建表
  await db.run(`
    create table if not exists auth (
      token_hash    varchar(64)   primary key,
      cardnum       varchar(64)   not null,
      password      varchar(128)  not null,
      name          varchar(192)  not null,
      schoolnum     varchar(64)   not null,
      cookie        varchar(256)  not null,
      version_desc  varchar(128)  not null,
      registered    integer       not null,
      last_invoked  integer       not null
    )
  `, [])

  const ONE_DAY = 1000 * 60 * 60 * 24

  // 定期清理过期授权，超过指定天数未使用的将会过期
  setInterval(() => {
    db.run('delete from auth where last_invoked < ?',
      [new Date().getTime() - config.auth.expireDays * ONE_DAY])
  }, ONE_DAY)
})()

// 对称加密算法，要求 value 是 String 或 Buffer，否则会报错
const encrypt = (key, value) => {
  let cipher = crypto.createCipher(config.auth.cipher, key)
  let result = cipher.update(value, 'utf8', 'hex')
  result += cipher.final('hex')
  return result
}

// 对称解密算法，要求 value 是 String 或 Buffer，否则会报错
const decrypt = (key, value) => {
  let decipher = crypto.createDecipher(config.auth.cipher, key)
  let result = decipher.update(value, 'hex', 'utf8')
  result += decipher.final('utf8')
  return result
}

// 加密和解密过程
module.exports = async (ctx, next) => {

  // 对于 auth 路由的请求，直接截获，不交给 kf-router
  if (ctx.method.toUpperCase() === 'POST' && ctx.path === '/auth') {

    // 获取一卡通号、密码、前端定义版本
    let { cardnum, password, version } = ctx.params
    let username = cardnum

    // 调用东大 APP 统一身份认证
    let res = await ctx.post(
      'http://mobile4.seu.edu.cn/_ids_mobile/login18_9',
      { username, password }
    )

    // 验证不通过，抛出错误
    if (res.status >= 400) {
      ctx.throw(res.status)
      return
    }

    // 抓取 Cookie
    let cookie = res.headers['set-cookie']
    if (Array.isArray(cookie)) {
      cookie = cookie.filter(k => k.indexOf('JSESSIONID') + 1)[0]
    }
    cookie = /(JSESSIONID=[0-9A-F]+)\s*[;$]/.exec(cookie)[1]

    let { cookieName, cookieValue } = JSON.parse(res.headers.ssocookie)[0]
    cookie = `${cookieName}=${cookieValue};${cookie}`

    // 获取用户附加信息（仅姓名和学号）
    // 对于本科生，此页面可显示用户信息；对于其他角色（研究生和教师），此页面重定向至老信息门户主页。
    // 但对于所有角色，无论是否重定向，右上角用户姓名都可抓取；又因为只有本科生需要通过查询的方式获取学号，
    // 研究生可直接通过一卡通号截取学号，教师则无学号，所以此页面可以满足所有角色信息抓取的要求。
    res = await ctx.get('http://myold.seu.edu.cn/index.portal?.pn=p3447_p3449_p3450', {
      headers: { Cookie: cookie }
    })

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

    // 截取学号（研究生 Only）
    if (/^22/.test(cardnum)) {
      schoolnum = cardnum.slice(1)
    }

    // 生成 32 字节 token 转为十六进制，及其哈希值
    let token = new Buffer(crypto.randomBytes(32)).toString('hex')
    let tokenHash = new Buffer(crypto.createHash('md5').update(token).digest()).toString('base64')

    // 用 token 加密用户密码和统一身份认证 cookie
    let passwordEncrypted = encrypt(token, password)
    let cookieEncrypted = encrypt(token, cookie)

    // 将新用户信息插入数据库
    let now = new Date().getTime()
    await db.run(`insert into auth (
      token_hash,  cardnum,  password,           name,  schoolnum,  cookie,          version_desc,  registered, last_invoked
    ) values (
      ?,           ?,        ?,                  ?,     ?,          ?,               ?,             ?,          ?
    )`, [
      tokenHash,   cardnum,  passwordEncrypted,  name,  schoolnum,  cookieEncrypted, version || '', now,        now
    ])

    // 返回 token
    ctx.body = token

  } else if (ctx.request.headers.token) { // 对于其他请求，根据 token 的哈希值取出表项

    let token = ctx.request.headers.token
    let tokenHash = new Buffer(crypto.createHash('md5').update(token).digest()).toString('base64')

    let record = await db.get('select * from auth where token_hash = ?', [tokenHash])
    if (record) {
      let now = new Date().getTime()

      // await-free
      // 更新用户最近调用时间
      db.run('update auth set last_invoked = ? where token_hash = ?', [now, tokenHash])

      // 解密用户密码
      let { cardnum, password, name, schoolnum, cookie } = record
      password = decrypt(token, password)
      cookie = decrypt(token, cookie)

      // 向饼干罐添加初始饼干 🍪
      // 数据库中加密的 Cookie 其实是用分号隔开的两个不同 Cookie，需要分别设置；
      // 另外需要加 Domain 字段，表示这两个 Cookie 适用于全校网站
      ctx.useCookie = () => {
        cookie.split(';').map(c => {
          ctx.cookieJar.setCookieSync(
            tough.Cookie.parse(c + '; Domain=.seu.edu.cn'), 'http://www.seu.edu.cn', {}
          )
        })
      }

      // 将伪 token、解密后的一卡通号、密码和 Cookie、加解密接口暴露给下层中间件
      ctx.user = {
        isLogin: true,
        encrypt: encrypt.bind(undefined, token),
        decrypt: decrypt.bind(undefined, token),
        token: tokenHash,
        cardnum, password, name, schoolnum, cookie
      }

      // 调用下游中间件
      await next()
    }
  } else {

    // 对于没有 token 的请求，若下游中间件要求取 user，说明功能需要登录，抛出 401
    let reject = () => ctx.throw(401)
    ctx.user = {
      isLogin: false,
      get encrypt() { reject() },
      get decrypt() { reject() },
      get token() { reject() },
      get cardnum() { reject() },
      get password() { reject() },
      get name() { reject() },
      get schoolnum() { reject() },
      get cookie() { reject() }
    }

    ctx.useCookie = reject

    // 调用下游中间件
    await next()
  }
}
