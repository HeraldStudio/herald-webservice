const db = require('sqlongo')('auth')

db.auth = {
  cardnum:            'text not null',    // 一卡通号
  tokenHash:          'text primary key', // 令牌哈希值 = Base64(MD5(token))，用于根据私钥找到用户
  tokenEncrypted:     'text not null',    // 令牌加密值 = Base64(MD5(cipher(明文密码, token)))
  passwordEncrypted:  'text not null',    // 密码加密值 = Base64(MD5(cipher(token, 明文密码)))
  passwordHash:       'text not null',    // 密码哈希值 = Base64(MD5(明文密码))，用于本地核验用户密码

  gpasswordEncrypted: 'text not null',    // 研究生院系统密码 = Base64(MD5(cipher(token, 明文密码)))
  name:               'text not null',    // 姓名
  schoolnum:          'text not null',    // 学号（教师为空）
  platform:           'text not null',    // 平台名，同一平台不允许多处登录
  registered:         'int not null',     // 认证时间
  lastInvoked:        'int not null'      // 上次使用时间，超过一定设定值的会被清理
}

// 定期清理过期授权，超过指定天数未使用的将会过期
setInterval(() => {
  db.auth.remove({
    lastInvoked: { $lt: +moment().subtract(config.auth.expireDays, 'days') }
  })
}, +moment.duration(1, 'day'))

module.exports = db
