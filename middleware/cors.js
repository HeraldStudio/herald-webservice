// 允许的第三方前端域名，精确匹配
const allowDomains = [
  /\.myseu\.cn$/,
  /^myseu\.cn$/,
  /^app\.heraldstudio\.com$/,
  /^www\.heraldstudio\.com$/,
  /^localhost$/,
  /^127\./,
  /^172\./,
  /^192\./
]

module.exports = async (ctx, next) => {
  let { origin } = ctx.request.headers
  if (origin) {
    ctx.set('Access-Control-Allow-Origin', origin)
    ctx.set('Access-Control-Allow-Methods', 'GET,HEAD,PUT,POST,DELETE,PATCH')
    ctx.set('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,token,cache,x-api-token')
  }
  if (ctx.method.toUpperCase() === 'OPTIONS') {
    ctx.body = ''
    ctx.status = 200
  } else {
    await next()
  }
}
