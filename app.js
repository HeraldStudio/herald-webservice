const koa = require('koa')
const app = new koa()
const config = require('./config.json')
const axios = require('axios')

// 关闭 HTTPS 网络请求的安全验证
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// 通用网络请求接口
// 通过把 app.axios 赋给 ctx.axios 可允许在路由程序中用 this.axios 获得此实例
app.axios = axios.create(config.axios)

// 自身请求接口
app.loopClient = axios.create({
  baseURL: `http://localhost:${config.port}/`
});

// 利用 app.get/post/put/delete 可直接请求自身
['get', 'post', 'put', 'delete'].forEach(method => app[method] = app.loopClient[method])

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

// require 并不用缓存，node 自己有 require 缓存
function requireHandler(js) {
  function tryRequire(js) {
    try {
      return require(js)
    } catch (e) {
      if (e.message !== `Cannot find module '${js}'`) {
        console.error(e)
      }
    }
  }

  // 若找不到，把 js 文件名当做文件夹去找里面的index
  return tryRequire(js) || tryRequire(js + '/index') || null
}

// 路由策略，根据请求自动引入对应 js 文件
app.use(async ctx => {
  let [route, method] = [ctx.path, ctx.method.toLowerCase()]

  // 路径安全检查，支持字母数字符号下划线中划线，多个斜杠必须分开，结尾斜杠可有可无；不允许调用 node_modules 中的程序
  if (/^(\/[0-9a-zA-Z_\-]+)*\/?$/.exec(route) && route.indexOf('node_modules') === -1) {

    // 统一去掉结尾斜杠
    let handlerName = route.replace(/\/$/, '')

    // 转换为相对路径，进行 require
    let handler = requireHandler('.' + handlerName)
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
