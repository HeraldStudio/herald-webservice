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
const { config } = require('../app')
let client

if (process.env.NODE_ENV === 'development') {
  const chalk = require('chalk')
  const pool = {}

  const summarize = (obj, length) => {
    let str = String(obj)
    if (str.length > length) {
      str = str.substring(0, length) + '...'
    }
    return str
  }

  client = {
    set (key, value) {
      pool[key] = value
      console.log('dev-fake-redis [set]', chalk.cyan(key), summarize(value, 32))
    },
    async getAsync (key) {
      let value = pool[key] || 'null'
      console.log('dev-fake-redis [get]', chalk.cyan(key), summarize(value, 32))
      return value
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
    client.set(key, JSON.stringify({ value, time }))
  },
  async get(key, ttl) {
    if (key && ttl) {
      let got = JSON.parse(await client.getAsync(key))
      if (got) {
        let expired = Math.floor(new Date().getTime() / 1000) - got.time >= ttl
        return [got.value, expired]
      }
    }
    return [null, true]
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
  constructor(str = '', parent) {
    if (parent !== undefined) {
      this.cacheTimeSeconds = parent.cacheTimeSeconds
      this.cacheIsPublic = parent.cacheIsPublic
      this.cacheIsLazy = parent.cacheIsLazy
      this.cacheIsManual = parent.cacheIsManual
    } else {
      this.cacheTimeSeconds = 0
      this.cacheIsPublic = false
      this.cacheIsLazy = false
      this.cacheIsManual = undefined
    }
    this.setStrategy(str)
  }
  setStrategy(str) {
    let properties = str.trim().split(/\s*,\s*/g)
    properties.forEach(prop => {
      if (/^\d+/.test(prop)) {
        if (this.cacheIsManual === undefined) { // 碰到缓存时间项，默认自动缓存
          this.cacheIsManual = false
        }
        if (strategyTimeCache.hasOwnProperty(prop)) {
          this.cacheTimeSeconds = strategyTimeCache[prop]
          return
        }
        let units = { y: 0, mo: 0, d: 0, h: 0, m: 0, s: 0 }
        prop.match(/[\d\.]+[a-z]+/g).forEach(k => {
          let parts = /([\d\.]+)([a-z]+)/g.exec(k)
          units[parts[2]] = parseFloat(parts[1])
        })
        this.cacheTimeSeconds = ((((units.y * 12
                                    + units.mo) * 30
                                   + units.d) * 24
                                  + units.h) * 60
                                 + units.m) * 60 + units.s
        strategyTimeCache[prop] = this.cacheTimeSeconds
      } else if (prop === 'public') {
        this.cacheIsPublic = true
      } else if (prop === 'private') {
        this.cacheIsPublic = false
      } else if (prop === 'lazy') {
        this.cacheIsLazy = true
      } else if (prop === 'eager') {
        this.cacheIsLazy = false
      } else if (prop === 'manual') {
        this.cacheIsManual = true
      } else if (prop === 'auto') {
        this.cacheIsManual = false
      }
    })
    if (this.cacheIsManual === undefined) { // 现在还没有指定缓存时间
      this.cacheIsManual = true
    }
  }
}

class CacheManager {
  constructor(ctx, strategy, name = null, derived = false) {
    this.ctx = ctx
    this.strategy = strategy
    this.derived = derived
    this.name = name
  }
  setStrategy(s) {
    this.strategy.setStrategy(s)
  }
  of(name) {
    if (this.derived) {
      this.name = name
      return this
    } else {
      return new CacheManager(this.ctx,
                              new CacheStrategy('', this.strategy),
                              name,
                              /* derived = */ true)
    }
  }
  inNext(time) {
    if (this.derived) {
      this.strategy.setStrategy(time)
      return this
    } else {
      return new CacheManager(this.ctx,
                              new CacheStrategy(time, this.strategy),
                              this.name,
                              /* derived = */ true)
    }
  }
  is(attr) {
    return this.inNext(attr)
  }
  async using(func) {
    let { ctx, strategy } = this
    /**
       ## 缓存命中

       将 method、地址 (路由 + querystring)、伪 token、请求体四个元素进行序列化，作为缓存命中判断的依据
       伪 token 是上游 auth 暴露的属性，用于区分用户，详见 auth.js##伪token

       下述「回源」均指调用下游中间件，取得最新数据的过程。

       缓存命中策略对照表：

       - 判断缓存状态：
       - 缓存有效未过期 => 取缓存，不回源
       - 缓存有效已过期 => 判断缓存策略：
        - 普通策略 => 等待回源，判断回源结果：
         - 回源成功：取回源结果，更新缓存 √
         - 回源失败：取缓存 √
        - 懒抓取策略 => 取缓存 √ 同时后台开始回源（脱离等待链），回源成功则更新缓存
       - 缓存无效 => 等待回源，判断回源结果：
        - 回源成功：取回源结果，更新缓存 √
        - 回源失败：返回错误信息 √
    */
    let cacheIsPrivate = !strategy.cacheIsPublic && ctx.user.isLogin
    let { cacheIsLazy } = strategy

    // 懒抓取策略下，缓存时间至少 5 秒，防止缓存时间未设置导致始终不缓存
    if (cacheIsLazy) {
      strategy.cacheTimeSeconds = Math.max(strategy.cacheTimeSeconds, 5)
    }

    // 对于超管，强制禁用任何缓存机制（否则由于超管不是用户，会被当做游客进行缓存，造成严重影响）
    if (ctx.admin.super) {
      strategy.cacheTimeSeconds = 0
    }

    let cacheKey = [
      cacheIsPrivate ? ctx.user.token : '',
      ctx.method,
      ctx.path,
      JSON.stringify(ctx.params),
      this.name
    ].join(' ').trim()

    let [cached, expired] = await cache.get(cacheKey, strategy.cacheTimeSeconds)

    // 1. 无论是否过期，首先解析缓存，准确判断缓存是否可用，以便在缓存不可用时进行回源
    // 此步骤结果保证：cached 成真 <=> 缓存可用，expired 成假 <=> 缓存未过期
    if (cached) {
      try {
        // [*] 上游是 auth 中间件，若为已登录用户，auth 将完成解密并把加解密函数暴露出来
        // 这里利用 auth 的加解密函数，解密缓存数据
        if (cacheIsPrivate) {
          cached = ctx.user.decrypt(cached)
        }
        cached = JSON.parse(cached)
      } catch (e) {
        cached = null
      }
    }

    // 2. 若缓存不可用或已过期，先回源，准确判断回源是否成功，以便在回源不成功时回落到过期缓存
    if (!cached || expired) {

      // 判断是否执行脱离等待链策略
      // 只有当设置了懒抓取模式且有缓存时，脱离等待链；否则不脱离等待链
      let cacheNoAwait = cacheIsLazy && cached

      // 异步的回源任务（执行下游中间件、路由处理程序）
      let task = async () => {

        // 若有缓存，则回源前先将原有缓存重新设置一次，缓存内容保持不变，缓存时间改为现在
        // 因此，若用户在回源完成前重复调用同一接口，将直接命中缓存，防止重复触发回源
        if (cached && strategy.cacheTimeSeconds) {
          cache.set(cacheKey, cached)
        }

        let res = await func()
        // 若需要缓存，将中间件返回值存入 redis
        if (strategy.cacheTimeSeconds && res) {
          cached = JSON.stringify(res)

          // 同 [*]，这里利用 auth 的加解密函数，加密数据进行缓存
          if (cacheIsPrivate) {
            cached = ctx.user.encrypt(cached)
          }
          cache.set(cacheKey, cached)
        }

        // 无论成功失败，都原样返回，留给后面判定
        return res
      }

      if (cacheNoAwait) {
        // 懒抓取模式且有过期缓存时，脱离等待链异步回源，忽略回源结果，然后直接继续到第三步取上次缓存值
        detachedTaskCount++

        task().catch(() => {}).then(() => detachedTaskCount--)
      } else {
        // 其余情况下，等待回源结束，返回回源结果
        return await task()
        // 此处如果回源出错，控制流程将直接流向 return.js
      }
    }

    // 3. 执行到此表示缓存未过期或(缓存存在但过期时)正在异步回源
    return cached
  }
  // this.cache.of('jwc').is('public').inNext('1d').using(fetchNews)
}

// 当前脱离等待链的回源任务计数
let detachedTaskCount = 0

module.exports = async (ctx, next) => { // next = kf-router

/**
  从 config 的 cache 项中向下寻找最符合当前条件的缓存策略

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
  while (jsonToParse && typeof jsonToParse === 'object' && path.length) {
    jsonToParse = jsonToParse[path.splice(0, 1)]
  }
  if (typeof jsonToParse !== 'string') {
    jsonToParse = ''
  }
  let strategy = new CacheStrategy(jsonToParse)
  ctx.cache = new CacheManager(ctx, strategy)
  let res = await (
    strategy.cacheIsManual
      ? next()
      : ctx.cache.using(next))
  if (res) { // 回源出错时便不覆盖 ctx.body，防止 status 因为 body 为空而变成204
    ctx.body = res
  }
}

// 可导入本模块之后取 detachedTaskCount 获得当前脱离等待链任务数
Object.defineProperty(module.exports, 'detachedTaskCount', {
  get () {
    return detachedTaskCount
  }
})
