/**
  # 日志中间件

  代替 koa 的日志中间件，为了解析 return.js 中间件返回的 JSON 状态码，并且为了好看。
 */
const chalk = require('chalk')

module.exports = async (ctx, next) => {
  let begin = new Date()
  await next()
  let end = new Date()
  let duration = end - begin
  let time = end.getHours()
    + ':' + ('0' + end.getMinutes()).split('').slice(-2).join('')
    + ':' + ('0' + end.getSeconds()).split('').slice(-2).join('')

  console.log(
    '  ' + time +
    ' | ' + (ctx.body.success ? chalk.green(ctx.body.code) : chalk.red(ctx.body.code)) +
    ' ' + ctx.method +
    ' ' + chalk.blue(ctx.path) +
    ' ' + duration + 'ms'
  )
}
