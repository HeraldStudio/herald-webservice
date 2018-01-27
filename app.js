const koa = require('koa')
const app = new koa()
const kf = require('kf-router')
const logger = require('koa-logger')
const bodyparser = require('koa-bodyparser')
const config = require('./config.json')

// 出错输出
process.on('unhandledRejection', e => { throw e })
process.on('uncaughtException', console.trace)

// 日志中间件
app.use(logger())

// 请求体解析中间件
// 由于 koa 默认是不解析请求体直接处理的，所以用了这个中间件后对于有请求体的请求，会多花费一定的时间来解析
app.use(bodyparser())

// WS3 框架中间件
app.use(require('./middleware/axios'))
app.use(require('./middleware/redis'))
app.use(require('./middleware/auth'))

// kf-router 是中间件最后一层，要在最后引入
app.use(kf(module))
app.listen(config.port)
