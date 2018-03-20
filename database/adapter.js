const db = require('sqlongo')('adapter')

db.auth = {
  uuid: 'text primary key',   // ws2 uuid
  cardnum: 'text not null',   // 一卡通号，用于识别用户是否已存在
  token: 'text not null',     // 对应的 ws3 token
  libPwd: 'text not null',    // 上次保存的图书馆密码
  libCookie: 'text not null', // 上次使用的图书馆 Cookie
}

module.exports = db
