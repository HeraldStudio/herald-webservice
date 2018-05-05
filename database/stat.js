const db = require('sqlongo')('stat')

db.stat = {
  time:       'int not null',
  identity:   'text not null',
  platform:   'text not null',
  route:      'text not null',
  method:     'text not null',
  status:     'int not null',
  duration:   'int not null',
}

// 每次初始化时清理超过两年的日志
db.stat.remove({ time: { $lt: +moment().subtract(2, 'years') }})

module.exports = db
