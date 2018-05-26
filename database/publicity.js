const db = require('sqlongo')('publicity')

db.banner = {
  bid:              'integer primary key',
  title:            'text not null',    // 标题
  pic:              'text not null',    // 图片地址
  url:              'text not null',    // 链接地址
  startTime:        'int not null',     // 有效期开始时间
  endTime:          'int not null',     // 有效期结束时间
  schoolnumPrefix:  'text not null',    // 目标用户的学号前缀，可用于向某院/某系/某班/某人定向推送
}

// 二元关系：「用户已点击轮播图」
db.bannerClick = {
  bid:              'int not null', 
  identity:         'text not null'    // 数据库中要区分用户时务必用 identity
}

db.notice = {
  nid:              'integer primary key',
  title:            'text not null',    // 标题
  content:          'text not null',    // 内容
  publishTime:      'int not null'      // 发布时间
}

db.activity = {
  aid:              'integer primary key',
  title:            'text not null',    // 标题
  content:          'text not null',    // 内容
  pic:              'text not null',    // 图片地址
  url:              'text not null',    // 链接地址
  startTime:        'int not null',     // 有效期开始时间
  endTime:          'int not null',     // 有效期结束时间
}

// 二元关系：「用户已点击活动」
db.activityClick = {
  aid:              'int not null',
  identity:         'text not null'    // 数据库中要区分用户时务必用 identity
}

module.exports = db
