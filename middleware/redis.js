/**
 # redis 缓存中间件
   根据路由处理程序的设置，将返回值保存到 redis 缓存，一定时间之内再次调用可以提前取出返回
 */
const redis = require('redis')
const client = redis.createClient()
const bluebird = require('bluebird')
const config = require('../config.json')

bluebird.promisifyAll(redis.RedisClient.prototype)

// 不使用 redis 自带的缓存超时功能
// 因为我们需要在取缓存时动态决定超时时间，而不是在设置缓存时存入超时时间
const cache = {
  async set(key, value) {
    let time = Math.floor(new Date().getTime() / 1000)
    client.set(JSON.stringify(key), JSON.stringify({ value, time }))
  },
  async get(key, ttl) {
    if (key && ttl) {
      let got = JSON.parse(await client.getAsync(JSON.stringify(key)))
      return (got && Math.floor(new Date().getTime() / 1000) - got.time < ttl) ? got.value : null
    }
    return null
  }
}

const timeStrToSeconds = (str) => {
  let units = { y: 0, mo: 0, d: 0, h: 0, m: 0, s: 0 }
  str.match(/[\d\.]+[a-z]+/g).forEach(k => {
    let parts = /([\d\.]+)([a-z]+)/g.exec(k)
    units[parts[2]] = parseFloat(parts[1])
  })
  return ((((units.y * 12 + units.mo) * 30 + units.d) * 24 + units.h) * 60 + units.m) * 60 + units.s
}

// 时间解析需要时间，利用一个 object 对各路由的缓存时长进行缓存，若已经解析过就不再重复解析
let cacheTimeCache = {}

module.exports = async (ctx, next) => {

  // 从 config.json 的 cache 项中向下寻找最符合当前条件的缓存时间

  // 例如 GET /api/card/detail 时：
  // 首先检测 cache 是否为 object，若不是，将其整数值作为缓存时间；
  // 再检测 cache.api 是否为 object，若不是，将其整数值作为缓存时间；
  // 再检测 cache.api.card 是否为 object，若不是，将其整数值作为缓存时间；
  // 再检测 cache.api.card.detail 是否为 object，若不是，将其整数值作为缓存时间；
  // 最后检测 cache.api.card.detail.get 是否为 object，若不是，将其整数值作为缓存时间。
  let currentPath = config.cache
  let path = ctx.path + '/' + ctx.method.toLowerCase()
  let cacheTTL

  if (cacheTimeCache.hasOwnProperty(path)) { // 若已经计算过这个路由的缓存时长，直接取计算过的

    cacheTTL = cacheTimeCache[path]

  } else { // 否则进行计算

    let paths = path.replace(/^\//, '').split('/')
    while (typeof currentPath === 'object') {
      currentPath = currentPath.hasOwnProperty(paths[0]) ? currentPath[paths[0]] : currentPath['index']
      paths.splice(0, 1)
    }
    cacheTTL = currentPath || 0
    if (typeof cacheTTL === 'string' && /[a-z]/.test(cacheTTL)) {
      cacheTTL = timeStrToSeconds(cacheTTL)
    }
    cacheTimeCache[path] = cacheTTL
  }

  let cacheKey = JSON.stringify({
    method: ctx.method,
    href: ctx.href,
    token: ctx.token || '',
    body: ctx.request.body
  })

  let cached = null
  if (cacheTTL) {
    cached = await cache.get(cacheKey, cacheTTL)
    if (cached) {
      try {
        if (ctx.decrypt) {
          cached = ctx.decrypt(cached)
        }
        cached = JSON.parse(cached)
        ctx.body = cached
        return
      } catch (e) {}
    }
  }

  // 调用下层中间件
  await next()

  // 若缓存，将中间件返回值存入 redis
  if (cacheTTL) {
    cached = ctx.body
    cached = JSON.stringify(cached)
    if (ctx.encrypt) {
      cached = ctx.encrypt(cached)
    }
    cache.set(cacheKey, cached)
  }
}
