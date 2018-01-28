/**
  # 用户身份认证中间件

  提供对称加密算法，把用户名密码加密保存到 sqlite 数据库，请求时用私钥解密代替用户名密码进行请求
  目的是为了给缓存和用户密码进行加密，程序只有在用户请求期间可以解密用户密码和用户数据

  ## 依赖接口

  ctx.request.body    koa-bodyparser

  ## 暴露接口

  下列中间件接口仅已登录用户带 token 请求时有效。

  ctx.encrypt   (string => string)?   使用用户 token 加密字符串数据，返回加密后的十六进制字符串
  ctx.decrypt   (string => string)?   使用用户 token 解密十六进制字符串，返回解密后的字符串数据
  ctx.token     string?               伪 token，不能用于加解密，只用于区分用户
  ctx.cardnum   string?               用户
  ctx.password  string?
  ctx.cookie    string?
 */
const { Database } = require('sqlite3')
const db = new Database('auth.db')
const config = require('../config.json')
const crypto = require('crypto')

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

  if (ctx.path === '/auth') { // 对于 auth 路由的请求，直接截获，不交给 kf-router

    // 获取一卡通号、密码、前端定义版本
    let { cardnum, password, version } = ctx.query

    // 调用东大 APP 统一身份认证
    let res = await ctx.post(
      'http://mobile4.seu.edu.cn/_ids_mobile/login18_9',
      `username=${cardnum}&password=${password}`
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

    // 生成 32 字节 token 转为十六进制，及其哈希值
    let token = new Buffer(crypto.randomBytes(32)).toString('hex')
    let tokenHash = new Buffer(crypto.createHash('md5').update(token).digest()).toString('base64')

    // 用 token 加密用户密码和统一身份认证 cookie
    let passwordEncrypted = encrypt(token, password)
    let cookieEncrypted = encrypt(token, cookie)

    // 将新用户信息插入数据库
    let now = new Date().getTime()
    await db.run(`insert into auth (
      token_hash,  cardnum,  password,           cookie,          version_desc,  registered, last_invoked
    ) values (
      ?,           ?,        ?,                  ?,               ?,             ?,          ?
    )`, [
      tokenHash,   cardnum,  passwordEncrypted,  cookieEncrypted, version || '', now,        now
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
      db.run('update auth set last_invoked = ? where token_hash = ?', [now, tokenHash])

      // 解密用户密码
      let { cardnum, password, cookie } = record
      password = decrypt(token, password)
      cookie = decrypt(token, cookie)

      // 暴露加解密 API
      ctx.encrypt = encrypt.bind(undefined, token)
      ctx.decrypt = decrypt.bind(undefined, token)

      // 将伪 token、解密后的一卡通号、密码和 Cookie 暴露给下层中间件
      ctx.token = tokenHash
      ctx.cardnum = cardnum
      ctx.password = password
      ctx.cookie = cookie

      await next()
    }
  } else {
    // 没有 token 的请求一律拒绝
    ctx.throw(401)
  }
}
