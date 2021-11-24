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
    // 不考虑端口和协议
    let domain = (origin.split('/').slice(-1)[0] || '').split(':')[0] || ''
    if (domain && allowDomains.find(d => d.test(domain))) {
      ctx.set('Access-Control-Allow-Origin', origin)
      ctx.set('Access-Control-Allow-Methods', 'GET,HEAD,PUT,POST,DELETE,PATCH')
      ctx.set('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,token,cache')
    }
  }
  if (ctx.method.toUpperCase() === 'OPTIONS') {
    ctx.body = ''
    ctx.status = 200
  } else {
    await next()
  }
}
