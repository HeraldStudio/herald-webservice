/**
  # redis 缓存中间件( Pseudo-cache 伪缓存)

  经过改造后，这已经不是原来的redis缓存了

  根据路由处理程序的设置，将返回值保存到内存中，一定时间之内再次调用可以提前取出返回

  ## 依赖接口

  ctx.params          from params.js
  ctx.user.isLogin    from auth.js
  ctx.user.cardnum    from auth.js
  ctx.user.encrypt    from auth.js
  ctx.user.decrypt    from auth.js

  ## 提供接口

  ctx.userCache       async (...string, string, async () => any) => any    // 用户缓存，缓存内容加密
  ctx.publicCache     async (...string, string, async () => any) => any    // 公共缓存，缓存内容未加密
  
  // 在程序运行的时候可以调用相应的路由清理缓存，当然重启程序也就清理所有缓存

  ctx.clearUserCache  async () => undefined
  ctx.clearCache   async () => undefined
*/


// job pool，用于异步获取
const jobPool = {}

console.log(chalkColored.green('[+] Redis 中间件改造完成，使用内存 Object 作为缓存空间'))

// 缓存内容
const pool = {}

const summarize = (obj, length) => {
  let str = String(obj)
  if (str.length > length) {
    str = str.substring(0, length) + '...'
  }
  return str
}

/**
 * 最基本的三个方法
 * client.set()
 * client.getAsync()
 * client.batchDelete()
 * 接下来会对这三个方法进行封装，实现更多的功能
 */
const client = {
  set (key, value) {
    pool[key] = value
    console.log('Pseudo-cache [set]', chalkColored.cyan(key), summarize(value, 32))
    // console.log('Pseudo-cache [set]', chalkColored.cyan(key), value)
  },
  async getAsync (key) {
    let value = pool[key] || 'null'
    console.log('Pseudo-cache [get]', chalkColored.cyan(key), summarize(value, 32))
    // console.log('Pseudo-cache [get]', chalkColored.cyan(key), value)
    return value
  },
  batchDelete (keyword) {
    Object.keys(pool).filter(k => ~k.indexOf(keyword)).map(key => 
    { 
      console.log('Pseudo-cache [delete]', chalkColored.cyan(key), summarize(pool[key], 32))
      delete pool[key] 
    })
  }
}


/**
  ## 对client的set()和get()进行封装

  将 client 的 set/get 进行封装，允许 key/value 为任何 JSON 兼容类型；

  > 此处使用「存入时保存存入时间，取出时根据过期时长判断是否过期」的方法。
 */
const cache = {
  async set(key, value) {
    let time = +moment().unix()

    // Profile 模式
    let profileStart = +moment()

    client.set(key, JSON.stringify({ value, time }))

    // Profile 模式
    if (program.mode === 'profile') {
      let profileEnd = +moment()
      console.log(`[Profile] 缓存写入 ${profileEnd - profileStart} ms`)
    }
  },
  async get(key, ttl) {
    if (key && ttl) {
      // Profile 模式
      let profileStart = null
      if (program.mode === 'profile') {
        profileStart = +moment()
      }

      let got = JSON.parse(await client.getAsync(key))

      // Profile 模式
      if (program.mode === 'profile') {
        let profileEnd = +moment()
        console.log(`[Profile] 缓存读取 ${profileEnd - profileStart} ms`)
      }
      
      if (got) {
        // 判断是否已经过期
        let expired = +moment().unix() - got.time >= ttl
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
  - 策略串末尾加上加号表示 lazy 模式(懒加载模式)
 */

const parseDurationStr = (duration) => {
  // 匹配加号
  let isLazy = /\+$/.test(duration)
  let seconds = 0

  if (parseDurationStr.cache[duration]) {
    seconds = parseDurationStr.cache[duration]
  } else {
    let units = { y: 0, mo: 0, d: 0, h: 0, m: 0, s: 0 }
    duration.match(/[\d.]+[a-z]+/g).forEach(k => {
      let parts = /([\d.]+)([a-z]+)/g.exec(k)
      units[parts[2]] = parseFloat(parts[1])
    })
    seconds = ((((units.y * 12 + units.mo) * 30 + units.d) * 24 + units.h) * 60 + units.m) * 60 + units.s
    parseDurationStr.cache[duration] = seconds
  }

  // 懒抓取策略下，缓存时间至少 1 秒，防止缓存时间未设置导致始终不缓存
  if (seconds || isLazy) {
    seconds = Math.max(seconds, 1)
  }
  return { isLazy, seconds }
}

// 缓存时间字符串的缓存，666666666
parseDurationStr.cache = {}

/**
 * 内部函数 internalCached
 * 本函数将被 bind() 柯里化（处理剩余参数） (this -> ctx, isPublic -> 由调用的函数名指定)
 * 由于箭头函数没有动态 this，因此此函数需要写成 function
 *
 * 后续的参数是倒置式的可变参数 (...keys, duration, func)
 * keys 将使用空格拼接，duration 将作为时间串用于构造缓存策略，其中末尾加号代表 lazy。
 */
async function internalCached (isPublic, ...args) {
  let [duration, func] = args.slice(-2)
  let keys = args.slice(0, -2).join(' ')
  let { isLazy, seconds } = parseDurationStr(duration)
  // 强制回源
  let force = this.request.headers.cache === 'update'
  // 调试模式下，强制回源
  if (program.mode === 'development') {
    console.log('> ' + chalkColored.magenta( '调试模式下，强制回源'))
    force = true
  }

  /**
    将 method、地址 (路由 + querystring)、用户一卡通号和平台名、请求体四个元素进行序列化，作为缓存命中判断的依据
    this.user.cardnum 和 this.user.platform 是上游 auth 暴露的属性，用于区分用户。

    注：伪缓存仅存储在程序运行的平台，本身仅能通过管理员的路由接口进行操作，重启程序即可清空伪缓存。
    this.user.cardnum 和 this.user.platform 的存在保证同一用户登录同一平台时才能命中缓存。
    从理论上讲也不能让同一用户多端登录时共享缓存。

    下述「回源」均指调用传入的 func，取得最新数据的过程。

    缓存命中策略对照表：

    - 判断缓存状态：
      - 有缓存未过期 => 取缓存，不回源
      - 有缓存已过期 => 判断缓存策略：
        - 普通策略 => 等待回源，判断回源结果：
          - 回源成功：取回源结果，更新缓存 ✅
          - 回源失败：返回错误信息 ❌
        - 懒抓取策略 => 等待回源，同时等待超时三秒：
          - 回源成功：取回源结果，更新缓存 ✅
          - 回源失败：取缓存 ⚠️
          - 回源超时：取缓存 ⚠️
      - 无缓存 => 等待回源，判断回源结果：
        - 回源成功：取回源结果，更新缓存 ✅
        - 回源失败：返回错误信息 ❌
  */
  let isPrivate = !isPublic && this.user.cardnum

  let cacheKey = [
    isPrivate ? this.user.cardnum + ' ' + this.user.platform : '',
    this.method,
    this.path,
    JSON.stringify(this.params),
    keys
  ].join(' ').trim()
  
  let [cached, expired] = await cache.get(cacheKey, seconds)
  // 1. 无论是否过期，首先解析缓存，准确判断缓存是否可用，以便在缓存不可用时进行回源
  // 此步骤结果保证：cached 成真 <=> 缓存可用，expired 成假 <=> 缓存未过期
  if (cached && !force) {
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
  if (!cached || expired || force) {

    // 判断是否允许过期缓存
    let allowStale = isLazy && cached && !force

    // 无论是否需要 await，都检查任务是否存在
    // 如果不存在，创建一个
    let curJob = jobPool[cacheKey]
    if (!curJob) {
      curJob = jobPool[cacheKey] = (async () => {
        try {
          detachedTaskCount++
          let task = func()
          if (allowStale) {
            // 若允许过期缓存且有缓存，则将回源任务限制在3秒之内
            // 把超时归类为异常，然后统一在异常情况下返回缓存
            // 这样处理同时也使得回源函数中出现异常时，同样也返回缓存
            task = Promise.race([
              task, new Promise((_, r) => setTimeout(r, 15000))
            ]).catch(() => {
              // 回源函数出现任何异常，均返回 203，表示返回值无时效性
              this.status = 203
              return cached
            })
          }

          let res = await task
          // 若需要缓存，且回源成功，将回源返回值存入 redis
          if (seconds && res && this.status !== 203) {
            cached = JSON.stringify(res)
            // [*] 这里利用 auth 的加解密函数，加密数据进行缓存
            if (isPrivate) {
              cached = this.user.encrypt(cached)
            }
            cache.set(cacheKey, cached)
          }
          return res
        } finally {
          delete jobPool[cacheKey]
          detachedTaskCount--
        }
      })()
    }

    // 等待该回源任务完成
    return await curJob
  }

  // 3. 执行到此表示缓存未过期，返回缓存
  return cached
}


// 当前脱离等待链的回源任务计数
let detachedTaskCount = 0

module.exports = async (ctx, next) => {
  ctx.userCache = internalCached.bind(ctx, false)
  ctx.publicCache = internalCached.bind(ctx, true)

  // 清空当前用户缓存
  ctx.clearUserCache = async () => {
    let { cardnum } = ctx.user
    await client.batchDelete(cardnum)
  }

  // 以下仅允许对管理员使用该 API

  // 清空所有 key 中包含某字符串的缓存，留空则清空所有缓存
  // 例如:清除某一路由的缓存 clearCache('/api/gpa')；
  // 例如:清除某一用户的缓存 clearCache('213171610')；
  ctx.clearCache = async (keyword = '') => {
    await client.batchDelete(keyword)
  }

  // 查看所有 key 中包含某字符串的缓存，留空则查看所有缓存
  // 例如:查看某一路由的缓存 getCache('/api/gpa')；
  // 例如:查看某一用户的缓存 getCache('213171610')；
  ctx.getCache = async (keyword = '') => {
    const keyList = Object.keys(pool).filter(k => ~k.indexOf(keyword))
    keyList.forEach( async key => {
      await client.getAsync(key)
    })
  }
  

  await next()
}

// 可导入本模块之后取 detachedTaskCount 获得当前脱离等待链任务数
Object.defineProperty(module.exports, 'detachedTaskCount', {
  get () {
    return detachedTaskCount
  }
})
