const koa = require('koa')
const app = new koa()
const kf = require('kf-router')
const config = require('./config.json')

// 出错输出
process.on('unhandledRejection', e => { throw e })
process.on('uncaughtException', console.trace)

/**
  # WS3 框架中间件
  以下中间件共分为四层，每层内部、层与层之间都严格按照依赖关系排序。

  ## A. 监控层
  负责对服务运行状况进行监控，便于后台分析和交互，对服务本身不存在影响的中间件。
 */
// 1. 命令行最后一行的利用。如果是生产环境，显示请求计数器；开发环境下，让给 REPL
// 此中间件在 module load 时，会对 console 的方法做修改
if (process.env.NODE_ENV === 'production') {
  app.use(require('./middleware/counter'))
} else {
  require('./repl').start()
}
// 2. 日志输出，需要依赖返回格式中间件中返回出来的 JSON 格式
app.use(require('./middleware/logger'))

/**
  ## B. 接口层
  为了方便双方通信，负责对服务收到的请求和发出的返回值做变换的中间件。
 */
// 1. 返回格式化和参数格式化，属于同一层，互不依赖
app.use(require('./middleware/return'))
app.use(require('./middleware/params'))

app.use(require('./middleware/spider_server'))

/**
  ## C. API 层
  负责为路由处理程序提供 API 以便路由处理程序使用的中间件。
 */
// 1. 网络请求，为身份认证和路由处理程序提供了网络请求 API
app.use(require('./middleware/axios'))
// 2. 身份认证，为下面 redis 缓存提供了加解密函数
app.use(require('./middleware/auth'))
// 3. redis 缓存，为路由处理程序提供自动缓存
app.use(require('./middleware/redis'))

/**
  ## D. 路由层
  负责调用路由处理程序执行处理的中间件。
*/
app.use(kf(module, { hotReload: process.env.NODE_ENV === 'development' }))
app.listen(config.port)
