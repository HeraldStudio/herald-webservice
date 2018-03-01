const db = require('sqlongo')('publicity')

db.banner = {
  bid:              'integer primary key',
  title:            'text not null',    // 标题
  pic:              'text not null',    // 图片地址
  url:              'text not null',    // 链接地址
  startTime:       'int not null',      // 有效期开始时间
  endTime:         'int not null',      // 有效期结束时间
  schoolnumPrefix: 'text not null',     // 目标用户的学号前缀，可用于向某院/某系/某班/某人定向推送
}

db.notice = {
  nid:              'integer primary key',
  title:            'text not null',    // 标题
  content:          'text not null',    // 内容
  url:              'text not null',    // 链接地址
  schoolnumPrefix: 'text not null',     // 目标用户的学号前缀，可用于向某院/某系/某班/某人定向推送
}

db.activity = {
  aid:              'integer primary key',
  title:            'text not null',    // 标题
  content:          'text not null',    // 内容
  pic:              'text not null',    // 图片地址
  url:              'text not null',    // 链接地址
  startTime:       'int not null',      // 有效期开始时间
  endTime:         'int not null',      // 有效期结束时间
  committedBy:     'text not null',     // 发布者一卡通号
  admittedBy:      'text not null'      // 审核人一卡通号，空串表示未审核
}

module.exports = db
