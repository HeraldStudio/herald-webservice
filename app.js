const koa = require('koa')
const app = new koa()
const kf = require('kf-router')
const config = require('./config.json')

// 出错输出
process.on('unhandledRejection', e => { throw e })
process.on('uncaughtException', console.trace)

// WS3 框架中间件，其中 redis 依赖 auth，不能倒置
app.use(require('./middleware/logger'))
app.use(require('./middleware/return'))
app.use(require('./middleware/params'))
app.use(require('./middleware/axios'))
app.use(require('./middleware/auth'))
app.use(require('./middleware/redis'))

// kf-router 是中间件最后一层，要在最后引入
app.use(kf(module))
app.listen(config.port)
