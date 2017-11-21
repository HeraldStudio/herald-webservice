const koa = require('koa')
const app = new koa()
const config = require('./config.json')

// 通用网络请求接口
// 在路由程序中 this.app.axios 可获得此实例
app.axios = require('axios').create(config.axios)

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

// require 缓存策略，防止每次请求重复 require 占用文件系统资源
const requireCache = {}, cachedRequire = js => {

  // 如果 require 缓存中有该 handler，直接返回对象
  if (requireCache.hasOwnProperty(js)) {
    return requireCache[js]

  } else { // 否则执行 require 并存入缓存
    try {
      let required = require(js)
      requireCache[js] = required
      return required
    } catch (e) {
      console.log(e)
    }

    // 找不到，把 js 文件名当做文件夹去找里面的index
    try {
      let required = require(js + '/index')
      requireCache[js] = required
      return required
    } catch (e) {
      console.log(e)
    }

    return null
  }
}

// 路由策略，根据请求自动引入对应 js 文件
app.use(async ctx => {
  let [route, method] = [ctx.path, ctx.method.toLowerCase()]

  // 路径安全检查，支持字母数字符号下划线中划线，多个斜杠必须分开，结尾斜杠可有可无
  if (/^(\/[0-9a-zA-Z_\-]+)*\/?$/.exec(route)) {

    // 统一去掉结尾斜杠
    let handlerName = route.replace(/\/$/, '')

    // 转换为相对路径，进行 require
    let handler = cachedRequire('.' + handlerName)
    if (handler) {

      // 若 require 成功，判断是否有对应方法的处理函数，没有该方法则 405
      if (handler.hasOwnProperty(method)) {

        // 把 axios 传给 ctx，方便使用
        ctx.axios = app.axios

        // 把 ctx 传给对应方法的 this 进行调用，在该方法内用 this 代替 koa 的 ctx
        // 由于路由处理程序为最终生产者，暂不提供 next 参数
        let result = handler[method].call(ctx)

        if (result) { // 若函数返回了一个值

          // 若返回的是 Promise 对象，则为异步函数，等待 Promise 处理完毕；如有错误，输出而不抛出
          if (result.toString() === '[object Promise]') {
            let finalResult = await result.catch(console.err)

            // 若 Promise 最终返回一个值，则将该值作为响应体
            if (finalResult) {
              ctx.body = finalResult
            }
          } else { // 普通函数返回一个值，也将该值作为响应体
            ctx.body = result
          }
        }
        return
      }
      ctx.throw(405)
      return
    }
  }

  // 路径不合法或 require 不成功，一律 404
  ctx.throw(404)
});

app.listen(config.port)
