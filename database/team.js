/**
 * 竞赛组队数据库
 */

const db = require('sqlongo')('team')

// 队伍信息
db.team = {
  tid:         'text primary key', // 团队唯一id
  teamName:    'text not null',    // 团队名称
  capacity:    'int not null',     // 团队总人数
  organizer:   'text not null',    // 发起人一卡通号
  expireTime:  'int not null',     // 截止日期
  updateTime:  'int not null',     // 最后更新时间
  description: 'text not null'     // 团队描述
}

// 对更新时间进行索引
db`create index if not exists teamIndex on team(updateTime)`

// 报名信息
db.registration = {
  rid:         'text primary key', // 报名唯一id
  tid:         'text not null',    // 报名的队伍id
  cardnum:     'text not null',    // 报名人一卡通号
  name:        'text not null',    // 报名人姓名
  description: 'text not null',    // 报名人自我介绍
  contact:     'text not null',    // 报名人联系方式
  status:      'text not null',    // 状态 'pending'|'accepted'|'rejected'
  updateTime:  'int not null'      // 最后更新时间
}

module.exports = db