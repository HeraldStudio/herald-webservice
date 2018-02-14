const db = require('sqlongo')('canteen')

db.canteen = {
  cid:             'int primary key', // 食堂ID
  name:            'text not null',   // 食堂名
  open_time_am:    'int not null',    // 上午开张时间，格式 hour * 60 + minute
  close_time_am:   'int not null',    // 上午闭店时间，格式 hour * 60 + minute
  open_time_pm:    'int not null',    // 下午开张时间，格式 hour * 60 + minute
  close_time_pm:   'int not null',    // 下午闭店时间，格式 hour * 60 + minute
  manager:         'text not null',   // 经理姓名
  manager_contact: 'text not null',   // 经理电话
  quanyi_contact:  'text not null',   // 权益君电话
  comment:         'text not null'    // 详情介绍
}

db.window = {
  wid:             'int primary key', // 窗口ID
  cid:             'int not null',    // 所在食堂ID
  floor:           'text not null',   // 楼层名
  name:            'text not null',   // 窗口名
  pic:             'text not null',   // 展示图片
  comment:         'text not null'    // 详情介绍
}

db.dish = {
  did:             'int primary key', // 菜品ID
  wid:             'int not null',    // 所在窗口ID
  name:            'text not null',   // 菜品名称
  type:            'text not null',   // 菜品大类
  pic:             'text not null',   // 展示图片
  breakfast:       'int not null',    // 是否早餐，早餐1，否则0
  price:           'int not null',    // 价格（以0.01元为单位）
  tag:             'text not null'    // 两三个字的简短标签（降价、新品等）
}

db.broadcast = {
  bid:             'int primary key', // 公告ID
  title:           'text not null',   // 公告标题
  content:         'text not null'    // 公告内容
}

module.exports = db
