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
    let domain = (origin.split('/').slice(-1)[0] || '').split(':')[0] || ''
    if (domain && ~allowDomains.indexOf(domain)) {
      ctx.set('Access-Control-Allow-Origin', origin)
      ctx.set('Access-Control-Allow-Methods', 'GET,HEAD,PUT,POST,DELETE,PATCH')
      ctx.set('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,token')
    }
  }
  if (ctx.method.toUpperCase() === 'OPTIONS') {
    ctx.body = ''
    ctx.status = 200
  } else {
    await next()
  }
}
