/**
 * 通用报名系统数据库定义
 * 
 * 通用报名系统从以下几个需求出发，希望基于 WS3 建立一个统一的系统实现这些需求：
 * 
 * 1. 金钥匙选课：金钥匙选课一般分为多个分区，每个分区中有多个分组，每个分组中有多个课程，
 *    要求每个分区可以单独设置最多选几个分组的课程，每个分组可以单独设置最多选几个课程，
 *    每个课程可单独设置名额，每个课程每人最多选一次；可选课的人员名单为自定义的一卡通列表；
 *    选课时要求用户填写手机号码；选课活动为定时开放，也可以手动开放。
 * 
 * 2. 讲座抢票：讲座抢票为单个活动的报名，发起者可指定允许抢票的用户范围；
 *    一个用户至多只能抢一张票；抢到票后，服务端生成二维码，入场时可扫码核销（验证票据真实性）；
 *    抢票活动为定时开放，也可以手动开放。
 * 
 * 3. 群内报名：群内报名与讲座抢票逻辑类似，侧重报名信息的填写。
 * 
 * 4. 投票：投票与金钥匙选课逻辑类似，人数不设上限，也无需填写信息。
 */

const db = require('sqlongo')('sign')

// 报名表的基本信息
db.sign = {
  sid:         'integer primary key',
  name:        'text not null',
  desc:        'text not null',
  image:       'text not null',
  mode:        'text not null', // 'timer' 定时开关 / 'on' 手动开 / 'off' 手动关
  startTime:   'int not null',
  endTime:     'int not null',
  userType:    'text not null', // 'all' 所有师生 / 'whitelist' 一卡通白名单 / 'glob' 学号通配符
  userGlob:    'text not null',
  input:       'text not null', // 需要用户填写的附加信息名称，格式为 JSON 数组
  createTime:  'int not null',
  committedBy: 'text not null',
  admittedBy:  'text not null',
  public:      'int not null'   // 1 展示在报名页，2 不展示
}

// 报名表包含的组
db.signGroup = {
  gid:          'integer primary key',
  sid:          'int not null',
  name:         'text not null',
  desc:         'text not null',
  maxSelection: 'int not null',
  mode:         'text not null' // 'normal' 普通图文 / 'avatar' 头像展示 / 'tag' 小标签展示(单选时新选项自动排斥旧选项)
}

// 报名表中的选项
db.signOption = {
  oid:      'integer primary key',
  gid:      'int',
  sid:      'int not null',
  name:     'text not null',
  desc:     'text not null',
  image:    'text not null',
  capacity: 'int not null',
}

// 报名参与者白名单
db.signWhitelist = {
  sid:     'int not null',
  cardnum: 'text not null'
}

db`create index if not exists whitelistIndex on signWhitelist(sid, cardnum)`

// 报名前的信息填写情况，为用户和报名表的关系表
db.signForm = {
  sid:        'int not null',
  cardnum:    'text not null',

  // 用户填写的附加信息值，格式为 JSON 数组
  // 由于在数据库中始终作为整体处理，不需要单独操作，故保存为一个字段
  input:      'text not null',
  
  submitTime: 'int not null' 
}

db`create index if not exists signFormIndex on signForm(sid, cardnum)`

// 报名选项结果，为用户和选项表的关系表
db.signOptionResult = {
  oid:        'int not null',
  cardnum:    'text not null',
  selectTime: 'int not null'
}

db`create index if not exists signOptionResultIndex on signOptionResult(oid, cardnum)`

module.exports = db