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
let client

// job pool，用于异步获取
const jobPool = {}

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
  - 策略串末尾加上加号表示 lazy 模式
 */
const parseDurationStr = (duration) => {
  let isLazy = /\+$/.test(duration)
  let seconds = 0

  if (parseDurationStr.cache.hasOwnProperty(duration)) {
    seconds = parseDurationStr.cache[duration]
  } else {
    let units = { y: 0, mo: 0, d: 0, h: 0, m: 0, s: 0 }
    duration.match(/[\d\.]+[a-z]+/g).forEach(k => {
      let parts = /([\d\.]+)([a-z]+)/g.exec(k)
      units[parts[2]] = parseFloat(parts[1])
    })
    seconds = ((((units.y * 12 + units.mo) * 30 + units.d) * 24 + units.h) * 60 + units.m) * 60 + units.s
    parseDurationStr.cache[duration] = seconds
  }

  // 懒抓取策略下，缓存时间至少 5 秒，防止缓存时间未设置导致始终不缓存
  // 如果设置了缓存时间，也至少 5 秒
  if (seconds || isLazy) {
    seconds = Math.max(seconds, 5)
  }
  return { isLazy, seconds }
}

parseDurationStr.cache = {}

/**
 * 内部函数 internalCached
 * 本函数将被 bind() 柯里化 (this -> ctx, isPublic -> 由调用的函数名指定)
 * 由于箭头函数没有动态 this，因此此函数需要写成 function
 *
 * 后续的参数是倒置式的可变参数 (...keys, duration, func)
 * keys 将使用空格拼接，duration 将作为时间串用于构造缓存策略，其中末尾加号代表 lazy。
 */
async function internalCached (isPublic, ...args) {
  let [duration, func] = args.slice(-2)
  let keys = args.slice(0, -2).join(' ')
  let { isLazy, seconds } = parseDurationStr(duration)

  /**
    将 method、地址 (路由 + querystring)、伪 token、请求体四个元素进行序列化，作为缓存命中判断的依据
    伪 token 是上游 auth 暴露的属性，用于区分用户，详见 auth.js##伪token

    下述「回源」均指调用传入的 func，取得最新数据的过程。

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
  let isPrivate = !isPublic && this.user.isLogin

  // 对于超管，强制禁用任何缓存机制（否则由于超管不是用户，会被当做游客进行缓存，造成严重影响）
  if (this.admin.super) {
    seconds = 0
  }

  let cacheKey = [
    isPrivate ? this.user.token : '',
    this.method,
    this.path,
    JSON.stringify(this.params),
    keys
  ].join(' ').trim()

  let [cached, expired] = await cache.get(cacheKey, seconds)

  // 1. 无论是否过期，首先解析缓存，准确判断缓存是否可用，以便在缓存不可用时进行回源
  // 此步骤结果保证：cached 成真 <=> 缓存可用，expired 成假 <=> 缓存未过期
  if (cached) {
    try {
      // [*] 上游是 auth 中间件，若为已登录用户，auth 将完成解密并把加解密函数暴露出来
      // 这里利用 auth 的加解密函数，解密缓存数据
      if (isPrivate) {
        cached = this.user.decrypt(cached)
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
    let noAwait = isLazy && cached

    // 异步的回源任务（执行下游中间件、路由处理程序）
    let task = async () => {

      // 现在并不需要重新设置缓存了
      // 因为如果重复调用，并不会新建任务

      let res = await func()
      // 若需要缓存，将中间件返回值存入 redis
      if (seconds && res) {
        cached = JSON.stringify(res)

        // 同 [*]，这里利用 auth 的加解密函数，加密数据进行缓存
        if (isPrivate) {
          cached = this.user.encrypt(cached)
        }
        cache.set(cacheKey, cached)
      }

      // 无论成功失败，都原样返回，留给后面判定
      return res
    }

    // 无论是否需要 await，都检查任务是否存在
    // 如果不存在，创建一个
    let curJob = jobPool[cacheKey]
    if (curJob === undefined) {
      detachedTaskCount++
      curJob = jobPool[cacheKey] =
        task().then(value => {
          detachedTaskCount--
          // 1 秒钟后删除
          // 一方面缓存至少 5 秒，成功后 1 秒以内再次请求肯定没有过期
          // 另一方面防止出现不 thread-safe 的情况
          setTimeout(() => { delete jobPool[cacheKey] }, 1000)
          return value
        }).catch(error => {
          detachedTaskCount--
          // 出现错误，立刻删除这个任务
          delete jobPool[cacheKey]
          // 然后原样把异常扔出去
          throw error
        })
      if (noAwait) {
        // 懒抓取模式且有过期缓存时，脱离等待链异步回源，忽略回源结果，然后直接继续到第三步取上次缓存值
        // lazy 忽略错误
        curJob.catch(() => {})
      }
    } // 否则，之前已经在异步回源了，不管它

    if (!noAwait) {
      // 非 lazy 情况下，等待回源结束，返回回源结果
      // 这个任务可能是刚创建的，也可能是由别处调用创建的
      // (但是总计只会获取一次)
      try {
        return await curJob
      } catch (error) { // 回源出错
        if (cached) { // 如果(过期)缓存存在，返回它
          return cached
        } else { // 缓存不存在，继续扔出错误，控制流程将直接流向 return.js
          throw error
        }
      }
    }
  }

  // 3. 执行到此表示缓存未过期或(缓存存在但过期时)正在异步回源
  return cached
}

// 当前脱离等待链的回源任务计数
let detachedTaskCount = 0

module.exports = async (ctx, next) => {
  ctx.userCache = internalCached.bind(ctx, false)
  ctx.publicCache = internalCached.bind(ctx, true)
  await next()
}

// 可导入本模块之后取 detachedTaskCount 获得当前脱离等待链任务数
Object.defineProperty(module.exports, 'detachedTaskCount', {
  get () {
    return detachedTaskCount
  }
})
