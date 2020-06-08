const mongodb = require('../database/mongodb')
/**
  # 日志中间件

  代替 koa 的日志中间件，为了解析 return.js 中间件返回的 JSON 状态码，并且为了好看。
 */


// 修改为使用MongoDB数据库保存log
module.exports = async (ctx, next) => {
  let begin = moment()
  await next()
  let end = moment()
  let duration = end - begin
  let time = end.format('H:mm:ss')
  let cardnum = '未登录'
  let name = '未登录'
  let platform = '未登录'


  if (ctx.request.headers['x-api-token'] ) {
    // 当请求中包含token，就可以向日志输出用户非敏感信息，以便于分析业务情况
    try {
      cardnum = ctx.user.cardnum
      name = ctx.user.name
      platform = ctx.user.platform
    } catch (e) { 
      //console.log(e)
    }
  }

  // 考虑到某些情况（如重定向）时，返回中没有 JSON 格式的 body，只有 status
  let status = ctx.body && ctx.body.code || ctx.status

  // 可读性log，用于美观和增加可读性
  let logMsg = ctx.logMsg
  console.log(
    '  ' + time +
    ' | ' + (status < 400 ? chalkColored.green(status) : chalkColored.red(status)) +
    ' ' + ctx.method +
    ' ' + chalkColored.blue(ctx.path) +
    ' ' + duration + 'ms' +
    (logMsg ? ' | ' + chalkColored.yellow(logMsg) : '')
  )
  
  try {
    let logCollection = await mongodb('webservice_log')
    await logCollection.insertOne({
      cardnum:  cardnum,
      username: name,
      status:   status,
      method:   ctx.method,
      path:     ctx.path,
      duration: duration,
      msg:      logMsg ? logMsg : '',
      platform: platform
    })
  } catch(e) {
    console.log('MongoDB服务出现错误', e)
  }
}
