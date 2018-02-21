const db = require('sqlongo')('stat')

const init = async () => {
  await db.stat.define({
    time:       'int not null',
    identity:   'text not null',
    platform:   'text not null',
    route:      'text not null',
    method:     'text not null',
    status:     'int not null',
    duration:   'int not null',
  })

  // 每次初始化时清理超过两年的日志
  const ONE_YEAR = 1000 * 60 * 60 * 24 * 365
  await db.stat.remove({ time: { $lt: new Date().getTime() - 2 * ONE_YEAR }})
}

init()
exports.db = db

exports.middleware = async (ctx, next) => {
  let start = new Date().getTime()
  try {
    await next()
  } finally {
    let end = new Date().getTime()
    let time = start
    let duration = end - start
    let identity = ctx.user.isLogin ? ctx.user.identity : 'guest'
    let platform = ctx.user.isLogin ? ctx.user.platform : 'guest'
    let route = ctx.path
    let method = ctx.method.toLowerCase()
    let status = ctx.body.code
    let record = { time, identity, platform, route, method, status, duration }
    await db.stat.insert(record)
  }
}
