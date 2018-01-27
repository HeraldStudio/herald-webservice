const koa = require('koa')
const app = new koa()
const config = require('./config.json')
const kf = require('kf-router')

app.use(require('./middleware/axios'))

// 计时日志中间件
app.use(async (ctx, next) => {
  let [route, method] = [ctx.path, ctx.method.toUpperCase()]
  let beginTime = new Date().getTime()
  await next().catch(console.err)
  let endTime = new Date().getTime()
  console.log(`${ctx.status} [${method}] ${route} ${endTime - beginTime}ms`)
})

// 通用缓存池
const pool = {}, cache = {
  set(key, value, ttl = 0) {
    pool[key] = { value, expires: ttl ? new Date().getTime() + ttl * 1000 : 0 }
  },
  get(key) {
    let got = pool[key]
    return got && got.expires > new Date().getTime() ? got.value : null
  },
  delete(key) {
    pool[key] = null
  }
}

// 通用缓存中间件
app.use(async (ctx, next) => {

  // 根据 url、方法、头中的 token、请求体四个元素进行匹配
  ctx.state.meta = JSON.stringify([
    ctx.url, ctx.method, ctx.headers.token, ctx.query
  ])

  // 若找到匹配的缓存，直接返回
  let cached = cache.get(ctx.state.meta)
  if (cached) {
    ctx.body = cached

  } else { // 找不到则发给下游路由程序进行处理
    await next()

    // 处理结束后存入缓存
    cache.set(ctx.state.meta, ctx.body, ctx.state.ttl)
  }
});

app.use(kf(module))
app.listen(config.port)
