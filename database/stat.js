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

db.raw('create index if not exists timeIndex on stat(time);')

// 每次初始化时清理超过两年的日志
const ONE_YEAR = 1000 * 60 * 60 * 24 * 365
db.stat.remove({ time: { $lt: new Date().getTime() - 2 * ONE_YEAR }})

module.exports = db
