// 允许的第三方前端域名，精确匹配
const allowDomains = [
  'myseu.cn',
  'app.heraldstudio.com',
  'www.heraldstudio.com',
  'localhost',
  '127.0.0.1'
]

module.exports = async (ctx, next) => {
  let { origin } = ctx.request.headers
  if (origin) {
    // 不考虑端口和协议
    origin = /[^/]*$/.exec(origin)[0]
    origin = /^[^:]*/.exec(origin)[0]

    if (origin && ~allowDomains.indexOf(origin)) {
      ctx.set('Access-Control-Allow-Origin', origin)
      ctx.set('Access-Control-Allow-Methods', 'GET,HEAD,PUT,POST,DELETE,PATCH')
      ctx.set('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,token')
    }
  }
  await next()
}
