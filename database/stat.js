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

// 每次初始化时清理超过两周的日志
// 这里不能直接用 time 做条件，会导致遍历所有日志，导致启动时发生拥塞
// 而是需要利用 time 的递增性，先查询第一个大于两周前的日志，然后删除所有这条日志之前的所有记录
db`delete from stat where rowid < (
  select rowid from stat where time > ${ +moment().subtract(2, 'weeks') } limit 1
);`

module.exports = db
