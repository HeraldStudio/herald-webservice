const koa = require('koa')
const app = new koa()
const kf = require('kf-router')
const fs = require('fs')
const cors = require('kcors')

// 设置所有 Promise 超时 20 秒，超过 20 秒自动 reject 并输出超时 Promise 所在位置
require('./promise-timeout')(20000)

// 将 moment 导出到全局作用域
global.moment = require('moment')

// 解析 YAML 配置文件
const config = require('js-yaml').load(fs.readFileSync('./config.yml'))
exports.config = config

// 为 Sqlongo ORM 设置默认路径
const sqlongo = require('sqlongo')
sqlongo.defaults.path = 'database'

// 为 Moment 设置默认语言
moment.locale('zh-cn')

// 出错输出
process.on('unhandledRejection', e => { throw e })
process.on('uncaughtException', console.trace)

// 监听两个结束进程事件，将它们绑定至 exit 事件，有两个作用：
// 1. 使用 child_process 运行子进程时，可直接监听主进程 exit 事件来杀掉子进程；
// 2. 防止按 Ctrl+C 时程序变为后台僵尸进程。
process.on('SIGTERM', () => process.exit())
process.on('SIGINT', () => process.exit())

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
// 2. 日志输出，需要依赖返回格式中间件中返回出来的 JSON 格式
app.use(require('./middleware/logger'))
// 3. 日志统计，用于匿名统计用户行为、接口调用成功率等
app.use(require('./middleware/statistics'))

/**
  ## B. 接口层
  为了方便双方通信，负责对服务收到的请求和发出的返回值做变换的中间件。
*/
// 1. 参数格式化，对上游传入的 URL 参数和请求体参数进行合并
app.use(require('./middleware/params'))
// 2. 返回格式化，将下游返回内容包装一层JSON
app.use(require('./middleware/return'))
// 3. 跨域中间件，定义允许访问本服务的第三方前端页面
app.use(require('./middleware/cors'))

/**
  ## B1. 兼容性临时层
  为了兼容使用旧版 webserv2 接口的前端，引入以下兼容性中间件，实现老接口的部分子集
  目前 adapter 不仅用于老版本兼容性，任何需要非 RESTful 返回格式的平台均需要 adapter，
  以防止不同风格代码的穿插，例如微信公众号的代码就是一个 adapter
*/
app.use(require('./middleware/adapter/ws2'))
app.use(require('./middleware/adapter/appserv'))
app.use(require('./middleware/adapter/wx-herald'))

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
// 6. redis 缓存，为路由处理程序提供手动缓存
//（开发环境下是假 redis，不需要安装redis）
app.use(require('./middleware/redis'))
// 7. guard 上游可用性预判断 API，需要依赖缓存中间件
app.use(require('./middleware/guard'))
// 8. Slack API
app.use(require('./middleware/slack').middleware)
// 9. 生产环境下验证码识别
if (process.env.NODE_ENV === 'production') {
  app.use(require('./middleware/captcha')({
    python: '/usr/local/bin/anaconda3/envs/captcha/bin/python'
  }))
}

/**
  ## D. 路由层
  负责调用路由处理程序执行处理的中间件。
*/
app.use(kf())
app.listen(config.port)

// 开发环境下，启动 REPL
if (process.env.NODE_ENV === 'development') {
  require('./repl').start()
}
