const db = require('sqlongo')('admin')

db.admin = {
  cardnum:    'text not null',  // 管理员一卡通号，一个人可以为多个管理员，所以可重复
  name:       'text not null',  // 管理员姓名
  phone:      'text not null',  // 管理员电话
  domain:     'text not null',  // 管理员权限域
  level:      'int not null',   // 管理员权限等级
  authorized: 'int not null',   // 管理员被授权时间
  lastUsed:  'int not null'    // 管理员最后调用时间
}

db.domain = {
  domain: 'text primary key',   // 管理员权限域
  name:   'text not null',      // 管理员权限域中文名
  desc:   'text not null'       // 管理员权限域职责说明
}

const define = async (domain, name, desc) => {
  if (domain === 'super') {
    throw 'super 为保留域'
  }

  if (await db.domain.find({ domain }, 1)) {
    return
  }

  await db.domain.insert({ domain, name, desc })
}

require('./admin.json').map(k => {
  let { domain, name, desc } = k
  define(domain, name, desc)
})

module.exports = db
