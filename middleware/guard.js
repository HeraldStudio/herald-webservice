/**
 * Guard 上游可用性预判断中间件
 * 允许路由在提供服务前判断上游可用性，若上游不可用，将直接抛出异常
 * 本中间件对上游可用性的判断是节流的（完全脱离等待链），是同步函数，不会增加处理时间
 * 使用时，将此 API 调用套在缓存中间件装饰器开头，可在上游不可用时直接触发取缓存并返回 203
 */
const pool = {}

module.exports = async (ctx, next) => {
  ctx.guard = url => {

    // 若判断结果不存在或已过期，先暂时认为现在上游是好的，然后脱离等待链重新追查上游状态
    if (!pool[url] || pool[url].lastUpdate < +moment().subtract(1, 'minute')) {
      pool[url] = {
        state: true,
        lastUpdate: +moment()
      }

      ctx.get(url).then(() => {
        pool[url] = {
          state: true,
          lastUpdate: +moment()
        }
      }).catch(() => {
        pool[url] = {
          state: false,
          lastUpdate: +moment()
        }
      })
    }

    // 当前状态为不可用时，抛出异常
    if (!pool[url].state) {
      throw 503
    }
  }
  await next()
}