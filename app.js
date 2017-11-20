const koa = require('koa')
const route = require('koa-route')
const cache = require('./cache')
const app = new koa()
const sleep = t => new Promise(r => setTimeout(r, t))

app.get     = (r, f) => app.use(route.get     (r, f))
app.post    = (r, f) => app.use(route.post    (r, f))
app.put     = (r, f) => app.use(route.put     (r, f))
app.delete  = (r, f) => app.use(route.delete  (r, f))
app.options = (r, f) => app.use(route.options (r, f))

app.use(async (ctx, next) => {
  ctx.state.meta = JSON.stringify([
    ctx.url, ctx.method, ctx.headers.token, ctx.query
  ])
  let cached = cache.get(ctx.state.meta)
  if (cached) {
    ctx.body = cached
  } else {
    await next()
    cache.set(ctx.state.meta, ctx.body, ctx.state.ttl)
  }
})

app.get('/', async ctx => {
  await sleep(3000)
  ctx.body = { hello: 'world' }
  ctx.state.ttl = 10
})

app.listen(3000)
