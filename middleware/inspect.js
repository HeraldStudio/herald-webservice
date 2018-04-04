const chalk = require('chalk')

// 在需要检视的位置引入此中间件，以在返回过程中输出 ctx 的当前状态。
module.exports = (tag = 'default') => {
  return async (ctx, next) => {
    try {
      await next()
      console.log(chalk.blue('inspect'), tag, chalk.cyan('↑'), ctx.status, ctx.body)
    } catch (e) {
      console.log(chalk.blue('inspect'), tag, chalk.red('↑ Thrown:'), chalk.red(e))
      throw e
    }
  }
}
