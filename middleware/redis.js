/**
 # redis 缓存中间件
   将用户请求返回保存到 redis 缓存
 */
const redis = require('redis')
const client = redis.createClient()
const bluebird = require('bluebird')

bluebird.promisifyAll(redis.RedisClient.prototype)

const cache = {
  async set(key, value, ttl = 0) {
    if (ttl > 0) {
      await client.set(key, value, 'EX', ttl)
    }
  },
  async get(key) {
    let got = await client.getAsync(key)
    return got || null
  }
}

module.exports = async (ctx, next) => {

  // 根据 url（含 query）、方法、请求体三个元素进行匹配（注意不含 header）
  ctx.state.meta = JSON.stringify([
    ctx.href, ctx.method, ctx.request.body
  ])

  // 若找到匹配的缓存，直接返回
  let cached = await cache.get(ctx.state.meta)
  if (cached) {
    ctx.body = cached

  } else { // 找不到则发给下游路由程序进行处理
    await next()

    // 处理结束后存入缓存
    /* no await */ cache.set(ctx.state.meta, ctx.body, ctx.state.ttl)
  }
}
