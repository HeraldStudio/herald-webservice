/**
  # redis 缓存中间件

  根据路由处理程序的设置，将返回值保存到 redis 缓存，一定时间之内再次调用可以提前取出返回

  ## 依赖接口

  ctx.params          from params.js
  ctx.user.isLogin    from auth.js
  ctx.user.token      from auth.js
  ctx.user.encrypt    from auth.js
  ctx.user.decrypt    from auth.js
 */
const config = require('../config.json')
let client

if (process.env.NODE_ENV === 'development') {
  const pool = {}
  client = {
    set (key, value) {
      pool[key] = value
    },
    async getAsync (key) {
      return pool[key] || 'null'
    }
  }
} else {
  const redis = require('redis')
  const bluebird = require('bluebird')
  bluebird.promisifyAll(redis.RedisClient.prototype)

  client = redis.createClient()
}

/**
  ## redis 缓存封装

  将 redis 的 set/get 进行封装，允许 key/value 为任何 JSON 兼容类型；

  > 由于本系统需要经常更改缓存时间，redis 自带的「存入时保存过期时间」的方法不适用，
    此处使用「存入时保存存入时间，取出时根据过期时长判断是否过期」的方法。
 */
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

/**
  ## 缓存策略字符串

  由于单位难以统一，缓存时间使用带单位字符串进行配置。

  ### 识别

  - 单位：y -> 年，mo -> 月，d -> 日，h -> 小时，m -> 分，s -> 秒；
  - 原理：通过正则识别所有 "数字串+字母串" 的组合，将单位有效的部分相乘相加；
  - 有效值举例：`1y` (360天) , `1h30m` (1小时30分) , `0.1mo1.5d` (4.5天)
  - 除时间外，还可以设置缓存是否由所有用户共享（如教务处等），只需在缓存时间串前面或后面加上 public，并使用逗号隔开即可。
  - 注意！与具体用户有关的路由，切勿设置为 public！
 */
const strategyTimeCache = {}

class CacheStrategy {
  constructor(str = '') {
    this.cacheTimeSeconds = 0
    this.cacheIsPublic = false
    let properties = str.trim().split(/\s*,\s*/g)
    properties.map(prop => {
      if (/^\d+/.test(prop)) {
        if (strategyTimeCache.hasOwnProperty(prop)) {
          this.cacheTimeSeconds = strategyTimeCache[prop]
        }
        let units = { y: 0, mo: 0, d: 0, h: 0, m: 0, s: 0 }
        prop.match(/[\d\.]+[a-z]+/g).forEach(k => {
          let parts = /([\d\.]+)([a-z]+)/g.exec(k)
          units[parts[2]] = parseFloat(parts[1])
        })
        this.cacheTimeSeconds = ((((units.y * 12 + units.mo) * 30 + units.d) * 24 + units.h) * 60 + units.m) * 60 + units.s
        strategyTimeCache[prop] = this.cacheTimeSeconds
      } else if (prop === 'public') {
        this.cacheIsPublic = true
      }
    })
  }
}

module.exports = async (ctx, next) => {

/**
  从 config.json 的 cache 项中向下寻找最符合当前条件的缓存策略

  > 例如 GET /api/card/detail 时：
    首先检测 cache 是否为 object，若不是，将其字符串作为缓存策略；
    再检测 cache.api 是否为 object，若不是，将其字符串作为缓存策略；
    再检测 cache.api 是否为 object，若不是，将其字符串作为缓存策略；
    再检测 cache.api.card 是否为 object，若不是，将其字符串作为缓存策略；
    再检测 cache.api.card.detail 是否为 object，若不是，将其字符串作为缓存策略；
    最后检测 cache.api.card.detail.get 是否为 object，若不是，将其字符串作为缓存策略。
 */

  let jsonToParse = config.cache
  let path = (ctx.path.replace(/^\//, '') + '/' + ctx.method.toLowerCase()).split('/')
  while (typeof jsonToParse === 'object' && path.length) {
    jsonToParse = jsonToParse[path.splice(0, 1)]
  }
  if (typeof jsonToParse !== 'string') {
    jsonToParse = ''
  }
  let strategy = new CacheStrategy(jsonToParse)

/**
  ## 缓存命中

  将 method、地址 (路由 + querystring)、伪 token、请求体四个元素进行序列化，作为缓存命中判断的依据
  伪 token 是上游 auth 暴露的属性，用于区分用户，详见 auth.js##伪token

  缓存命中的条件是 (缓存TTL > 0 && 缓存存在 && 缓存未过期 && 缓存解密成功)。
 */
  let cacheIsPrivate = !strategy.cacheIsPublic && ctx.user.isLogin

  let cacheKey = JSON.stringify({
    method: ctx.method,
    path: ctx.path,
    token: cacheIsPrivate ? ctx.user.token : '',
    params: ctx.params
  })

  let cached = null
  if (strategy.cacheTimeSeconds) {
    cached = await cache.get(cacheKey, strategy.cacheTimeSeconds)
    if (cached) {
      try {
        // [*] 上游是 auth 中间件，若为已登录用户，auth 将完成解密并把加解密函数暴露出来
        // 这里利用 auth 的加解密函数，解密缓存数据
        if (cacheIsPrivate) {
          cached = ctx.user.decrypt(cached)
        }
        cached = JSON.parse(cached)

        // 若到此均成功执行，说明缓存有效，直接返回
        ctx.body = cached
        return

      } catch (e) {}
    }
  }

/**
  ## 缓存回源

  若缓存命中流程不能进入 if/if/try，说明缓存无效，回源调用下层中间件，回源后再更新缓存。
 */
  await next()

  // 若需要缓存，将中间件返回值存入 redis
  if (strategy.cacheTimeSeconds && ctx.body) {
    cached = ctx.body
    cached = JSON.stringify(cached)

    // 同 [*]，这里利用 auth 的加解密函数，加密数据进行缓存
    if (cacheIsPrivate) {
      cached = ctx.user.encrypt(cached)
    }
    cache.set(cacheKey, cached)
  }
}
