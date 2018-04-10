(async () => {
  // 执行脚本后，用 auth2.db 替换 auth.db
  const crypto = require('crypto')
  const auth = require('sqlongo')('auth')
  const auth2 = require('sqlongo')('auth2')
  const adapter = require('sqlongo')('adapter')
  // const cp = require('child_process')
  // const $ = c => new Promise((r, j) => cp.exec(c, e => e ? j(e) : r()))

  process.on('unhandledRejection', e => { throw e })
  process.on('uncaughtException', console.trace)

  // 对称加密算法，要求 value 是 String 或 Buffer，否则会报错
  const encrypt = (key, value) => {
    try {
      let cipher = crypto.createCipher('aes-256-cfb', key)
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
      let decipher = crypto.createDecipher('aes-256-cfb', key)
      let result = decipher.update(value, 'hex', 'utf8')
      result += decipher.final('utf8')
      return result
    } catch (e) {
      return ''
    }
  }

  const hash = value => {
    return new Buffer(crypto.createHash('md5').update(value).digest()).toString('base64')
  }

  // 老表结构
  auth.auth = {
    tokenHash:          'text primary key', // 令牌哈希值 = Base64(MD5(token))，用于根据私钥找到用户
    cardnum:            'text not null',    // 一卡通号
    password:           'text not null',    // 密码加密值 = Base64(MD5(cipher(token, 明文密码)))
    gpassword:          'text not null',    // 研究生院系统密码 = Base64(MD5(cipher(token, 明文密码)))
    name:               'text not null',    // 姓名
    schoolnum:          'text not null',    // 学号（教师为空）
    platform:           'text not null',    // 平台名，同一平台不允许多处登录
    registered:         'int not null',     // 认证时间
    lastInvoked:        'int not null'      // 上次使用时间，超过一定设定值的会被清理
  }

  // 新表结构
  auth2.auth = {
    cardnum:            'text not null',
    tokenHash:          'text primary key',
    tokenEncrypted:     'text not null',
    passwordHash:       'text not null',
    passwordEncrypted:  'text not null',

    gpasswordEncrypted: 'text not null',
    name:               'text not null',
    schoolnum:          'text not null',
    platform:           'text not null',
    registered:         'int not null',
    lastInvoked:        'int not null'
  }

  adapter.auth = {
    uuid: 'text primary key',   // ws2 uuid
    cardnum: 'text not null',   // 一卡通号，用于识别用户是否已存在
    token: 'text not null',     // 对应的 ws3 token
    libPwd: 'text not null',    // 上次保存的图书馆密码
    libCookie: 'text not null', // 上次使用的图书馆 Cookie
  }

  let rows = await adapter.auth.find()

  for (let row of rows) {
    // 取出 Adapter 表中该行数据
    let { uuid, cardnum, token } = row
    // 对 token 进行哈希
    let tokenHash = hash(token)
    // 使用 token 哈希找到老 auth 表中对应数据
    let record = await auth.auth.find({ tokenHash }, 1)
    if (record) {
      let { password, gpassword, name, schoolnum, platform, registered, lastInvoked } = record
      // 两个密码实际是加密的，把名字让给明文密码
      let passwordEncrypted = password
      let gpasswordEncrypted = gpassword
      // 解密出明文密码
      password = decrypt(token, passwordEncrypted)
      gpassword = decrypt(token, gpasswordEncrypted)
      // 舍弃原来的 token，直接用 uuid 作为新的 token
      token = uuid
      // 对密码和新 token 进行哈希
      tokenHash = hash(token)
      let passwordHash = hash(password)
      // 用新的 token 加密两个密码
      passwordEncrypted = encrypt(token, password)
      gpasswordEncrypted = encrypt(token, gpassword)
      // 用统一身份认证密码加密新的 token
      let tokenEncrypted = encrypt(password, token)
      // 构造新 auth 数据
      row = {
        cardnum,
        tokenHash, tokenEncrypted, passwordHash, passwordEncrypted,
        gpasswordEncrypted,
        name, schoolnum, platform, registered, lastInvoked
      }
      await auth2.auth.insert(row)
      console.log(row)
    }
  }
})()
