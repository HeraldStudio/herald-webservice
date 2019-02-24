
// 在需要检视的位置引入此中间件，以在返回过程中输出 ctx 的当前状态。
module.exports = (tag = 'default') => {
  return async (ctx, next) => {
    try {
      await next()
      console.log(chalkColored.blue('inspect'), tag, chalkColored.cyan('↑'), ctx.status, ctx.body)
    } catch (e) {
      console.log(chalkColored.blue('inspect'), tag, chalkColored.red('↑ Thrown:'), chalkColored.red(e))
      throw e
    }
  }
}
