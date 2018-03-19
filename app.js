const koa = require('koa')
const app = new koa()
const kf = require('kf-router')
const fs = require('fs')
const cors = require('kcors')

// 解析 YAML 配置文件
const config = require('js-yaml').load(fs.readFileSync('./config.yml'))
exports.config = config

// 为 Sqlongo ORM 设置默认路径
const sqlongo = require('sqlongo')
sqlongo.defaults.path = 'database'

// 出错输出
process.on('unhandledRejection', e => { throw e })
process.on('uncaughtException', console.trace)

/**
  # WS3 框架中间件
  以下中间件共分为四层，每层内部、层与层之间都严格按照依赖关系排序。

  ## A0. 兼容性解包层
  对于兼容旧版 API 的兼容性接口，从兼容性临时层出来后被返回格式层进行封装，以便安全通过监控层，
  然后在最外层进行解包，以便调用者能得到符合旧版 API 返回格式的结果。
 */
app.use(require('./middleware/adapter/unpacker'))

/**
  ## A. 监控层
  负责对服务运行状况进行监控，便于后台分析和交互，对服务本身不存在影响的中间件。
 */
// 1. 如果是生产环境，显示请求计数器；此中间件在 module load 时，会对 console 的方法做修改
app.use(require('./middleware/counter'))
// 2. Slack API
app.use(require('./middleware/slack').middleware)
// 3. 日志输出，需要依赖返回格式中间件中返回出来的 JSON 格式
app.use(require('./middleware/logger'))
// 4. 日志统计，用于匿名统计用户行为、接口调用成功率等
app.use(require('./middleware/statistics'))

/**
  ## B. 接口层
  为了方便双方通信，负责对服务收到的请求和发出的返回值做变换的中间件。
 */
// 1. 返回格式化和参数格式化，属于同一层，互不依赖
app.use(require('./middleware/return'))
app.use(require('./middleware/params'))

/**
  ## B1. 兼容性临时层
  为了兼容使用旧版 webserv2 接口的前端，引入以下兼容性中间件，实现老接口的部分子集
 */
app.use(require('./middleware/adapter/ws2'))
app.use(require('./middleware/adapter/appserv'))

/**
  ## C. API 层
  负责为路由处理程序提供 API 以便路由处理程序使用的中间件。
 */
// 1. 接口之间相互介绍的 API
app.use(require('./middleware/related'))
// 2. 分布式硬件爬虫，为 axios 提供了底层依赖
app.use(require('./middleware/spider-server'))
// 3. 网络请求，为身份认证和路由处理程序提供了网络请求 API
app.use(require('./middleware/axios'))
// 4. 身份认证，为下面 redis 缓存提供了加解密函数
app.use(require('./middleware/auth'))
// 5. 管理员权限，需要依赖身份认证
app.use(require('./middleware/admin'))
// 6. redis 缓存，为路由处理程序提供自动缓存
app.use(require('./middleware/redis'))
// 7. 生产环境下验证码识别
if (process.env.NODE_ENV === 'production') {
  app.use(require('./middleware/captcha')({
    python: '/usr/local/bin/anaconda3/envs/captcha/bin/python'
  }))
}

/**
  ## D. 路由层
  负责调用路由处理程序执行处理的中间件。
*/
app.use(kf(module, {
  ignore: [
    '/middleware/**/*',
    '/database/**/*',
    '/docs/**/*',
    '/sdk/**/*',
    '/repl',
    '/app',
  ]
}))
app.listen(config.port)

// 开发环境下，启动 REPL
if (process.env.NODE_ENV === 'development') {
  require('./repl').start()
}
