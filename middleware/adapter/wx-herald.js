/**
 * wx-herald 小猴偷米微信公众号中间件
 */
const chalk = require('chalk')
const wechat = require('co-wechat')
const config = require('../../sdk/sdk.json').wechat['wx-herald']
const api = require('../../sdk/wechat').getAxios('wx-herald')

// 生产环境更新自定义菜单
if (process.env.NODE_ENV === 'production') {
  const menu = require('./wx-herald-menu.json')
  api.post('/menu/create', menu).then(res => {
    console.log(chalk.blue('[wx-herald] 自定义菜单 ') + res.data.errmsg)
  })
}

// 各种功能的 handler 函数
const handler = {
  async 绑定 (cardnum, password) {
    this.path = '/auth'
    this.method = 'POST'
    this.params = {
      cardnum, password,
      customToken: this.message.FromUserName,
      platform: 'wx-herald'
    }
    return await this.next().then(() => '绑定成功', e => `绑定失败 ${e}, ${this.params}`)
  },
  default () {
    return '公众号正在施工中，如有功能缺失请谅解~'
  }
}

// 分割用户指令并进入相应 handler 函数中
const middleware = wechat(config).middleware(async (message, ctx) => {
  let [cmd, ...args] = message.Content.trim().split(/\s+/g)
  ctx.request.headers.token = message.FromUserName
  ctx.message = message
  let originalPath = ctx.path
  let res = await (handler[cmd] || handler.default).call(ctx, args)
  ctx.path = originalPath
  return res
})

module.exports = async (ctx, next) => {
  if (ctx.path.indexOf('/adapter-wx-herald/') === 0) {
    ctx.next = next
    await middleware.call(this, ctx, next)
  } else {
    await next()
  }
}