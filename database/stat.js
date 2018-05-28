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
setInterval(() => {
  db.stat.remove({ time: { $lt: +moment().subtract(2, 'years') }})
}, +moment.duration(1, 'day'))

module.exports = db
