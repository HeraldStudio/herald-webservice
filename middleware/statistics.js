const db = require('../database/stat')

module.exports = async (ctx, next) => {
  let start = new Date().getTime()
  try {
    await next()
  } finally {
    let end = new Date().getTime()
    let time = start
    let duration = end - start
    let identity = ctx.user && ctx.user.isLogin ? ctx.user.identity : 'guest'
    let platform = ctx.user && ctx.user.isLogin ? ctx.user.platform : 'guest'
    let route = ctx.path
    let method = ctx.method.toLowerCase()
    let status = ctx.body.code
    let record = { time, identity, platform, route, method, status, duration }
    await db.stat.insert(record)
  }
}
