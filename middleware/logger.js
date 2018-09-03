/**
  # 日志中间件

  代替 koa 的日志中间件，为了解析 return.js 中间件返回的 JSON 状态码，并且为了好看。
 */
const chalk = require('chalk')

module.exports = async (ctx, next) => {
  let begin = moment()
  await next()
  let end = moment()
  let duration = end - begin
  let time = end.format('H:mm:ss')

  // 考虑到某些情况（如重定向）时，返回中没有 JSON 格式的 body，只有 status
  let status = ctx.body && ctx.body.code || ctx.status

  // 可读性log，用于美观和增加可读性
  let logMsg = ctx.logMsg

  console.log(
    '  ' + time +
    ' | ' + (status < 400 ? chalk.green(status) : chalk.red(status)) +
    ' ' + ctx.method +
    ' ' + chalk.blue(ctx.path) +
    ' ' + duration + 'ms' +
    (logMsg ? ' | ' + chalk.yellow(logMsg) : '')
  )
}
