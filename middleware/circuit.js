/**
 * 熔断器，当某个路由连续多次超时，则主动拒绝服务。
 */
const healthPool = {}

// 超时判定值
const TIMEOUT = 10000

// 熔断时间窗
const TIME_SPAN = 60000

// 时间窗内连续多少次超时或失败触发熔断
const MAX_FAIL_WITHIN_TIME_SPAN = 5

module.exports = async (ctx, next) => {
  if (healthPool[ctx.path] <= -MAX_FAIL_WITHIN_TIME_SPAN) {
    throw 503
  }

  let startTime = +moment()
  try {
    await next()
  } catch (e) {
    if (
      e.message && (
        /^Request failed with status code (\d+)$/.test(e.message) ||
        /^timeout of \d+ms exceeded$/.test(e.message)
      ) || (+moment() - startTime >= TIMEOUT)
    ) {
      healthPool[ctx.path] = (healthPool[ctx.path] || 0) - 1
      if (healthPool[ctx.path] === 1 - MAX_FAIL_WITHIN_TIME_SPAN) {
        console.log(`[circuit] 路由 ${ ctx.path } 失败或超时次数即将达到上限，准备熔断……`)
      }
      setTimeout(() => {
        healthPool[ctx.path]++
        if (healthPool[ctx.path] === 2 - MAX_FAIL_WITHIN_TIME_SPAN) {
          console.log(`[circuit] 路由 ${ctx.path} 恢复正常，已结束熔断`)
        }
      }, TIME_SPAN)
    }
  }
}