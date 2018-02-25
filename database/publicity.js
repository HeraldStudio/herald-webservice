const db = require('sqlongo')('publicity')

;(async () => {
  // 所有发布内容的共用表
  await db.publicity.define({
    pid:              'int primary key',
    title:            'text not null',    // 标题
    content:          'text not null',    // 内容
    pic:              'text not null',    // 图片地址
    url:              'text not null',    // 链接地址
    type:             'text not null',    // 轮播图 'banner'/ 通知公告 'notice'/ 校园活动 'activity'
    startTime:       'int not null',      // 有效期开始时间
    endTime:         'int not null',      // 有效期结束时间
    schoolnumPrefix: 'text not null',     // 目标用户的学号前缀，可用于向某院/某系/某班/某人定向推送
    committedBy:     'text not null',     // 发布者一卡通号
    admittedBy:      'text not null'      // 审核人一卡通号，空串表示未审核
  })

  // 记录每个用户对发布内容的互动
  await db.interaction.define({
    pid:          'int not null',
    identity:     'text not null',
    status:       'int not null',     // 1：已读 / 2：已点击
    attitude:     'int not null',     // 0：无表态 / 1：赞 / 2：不感兴趣
    updateTime:  'int not null'       // 修改时间
  })

  // 限制唯一而且方便查找
  await db.raw('create unique index if not exists interactionQueryIndex on interaction(pid, identity)')

  // 每天清理下线超过两周的发布内容的互动记录
  const TWO_WEEKS = 1000 * 60 * 60 * 24 * 14
  const ONE_DAY = 1000 * 60 * 60 * 24

  setInterval(async () => {
    let now = new Date().getTime()
    let pids = await db.publicity.distinct('pid', { end_time: { $lt: now - TWO_WEEKS }})
    pids.map(async pid => await db.interaction.remove({ pid }))
  }, ONE_DAY)
})()

module.exports = db
