// 允许的第三方前端地址正则表达式
// 注意开头要加 ^ 结尾要加 $ 以防止利用部分域名攻击
const allowOrigins = [
  /^(localhost|127\.0\.0\.1)(:\d+)?$/
]

module.exports = async (ctx, next) => {
  let { origin } = ctx.request.headers
  if (origin && allowOrigins.find(r => r.test(origin))) {
    ctx.set('Access-Control-Allow-Origin', origin)
    ctx.set('Access-Control-Allow-Methods', 'GET,HEAD,PUT,POST,DELETE,PATCH')
    ctx.set('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,token')
  }
  await next()
}
