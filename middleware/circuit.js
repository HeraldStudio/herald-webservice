/**
 * 熔断器，当某个路由连续多次超时，则主动拒绝服务。
 */
const healthPool = {}

// 超时判定值
const TIMEOUT = 10000

// 熔断时间窗
const TIME_SPAN = 60000

// 时间窗内连续多少次超时或失败触发熔断
const MAX_FAIL_WITHIN_TIME_SPAN = 3

module.exports = async (ctx, next) => {
  let startTime = +moment()
  let failTimestamps = healthPool[ctx.path] || []
  let oldLength = failTimestamps.length
  failTimestamps = failTimestamps.filter(k => k >= startTime - TIME_SPAN)
  let isDetecting = oldLength === MAX_FAIL_WITHIN_TIME_SPAN &&
    failTimestamps.length === MAX_FAIL_WITHIN_TIME_SPAN - 1
  if (isDetecting) {
    console.log(`[circuit] 路由 ${ ctx.path } 可用性重新探测中…`)
  }
  healthPool[ctx.path] = failTimestamps

  if (failTimestamps.length >= MAX_FAIL_WITHIN_TIME_SPAN) {
    let nextRetry = Math.ceil((failTimestamps[0] + TIME_SPAN - startTime) / 1000)
    console.log(`[circuit] 路由 ${ ctx.path } 处于熔断状态，${ nextRetry } 秒后开放下次探测…`)
    throw 503
  }

  try {
    await next()
    // 一旦出现成功，清空失败状态池
    healthPool[ctx.path] = []
    if (isDetecting) {
      console.log(`[circuit] 路由 ${ctx.path} 探测为恢复正常，解除熔断状态…`)
    }
  } catch (e) {
    let now = +moment()
    if (
      e.message && (
        /^Request failed with status code (\d+)$/.test(e.message) ||
        /^timeout of \d+ms exceeded$/.test(e.message)
      ) || (now - startTime >= TIMEOUT)
    ) {
      let failTimestamps = healthPool[ctx.path] || []
      failTimestamps = failTimestamps.filter(k => k >= now - TIME_SPAN)
      failTimestamps.push(now)
      healthPool[ctx.path] = failTimestamps

      if (!isDetecting && failTimestamps.length === MAX_FAIL_WITHIN_TIME_SPAN) {
        console.log(`[circuit] 路由 ${ ctx.path } 频繁失败，已暂时熔断…`)
      }
    }
  }
}