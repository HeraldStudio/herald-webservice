/**
  # 超时中间件

  为了防止某些特殊情况导致处理超时，在这里提供超时中间件，强制处理时间不超过20秒。
 */
module.exports = async (ctx, next) => {
  let timeout = new Promise((resolve, reject) => setTimeout(() => reject(504), 20000))
  await Promise.race([next(), timeout])
}
