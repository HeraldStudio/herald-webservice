/**
 * wx-herald 小猴偷米微信公众号中间件
 */
const wechat = require('co-wechat')
const config = require('../../sdk/sdk.json').wechat['wx-herald']
const api = require('../../sdk/wechat').getAxios('wx-herald')
const menu = require('./wx-herald-menu.json')
api.post('/menu/create', menu).then(res => console.log(res.data))

const handler = wechat(config).middleware(async (message, ctx) => {
  return 'Hello, World! 小猴偷米微信服务号施工中~'
})

module.exports = async (ctx, next) => {
  if (ctx.path.indexOf('/adapter-wx-herald/') === 0) {
    await handler.call(this, ctx, next)
  } else {
    await next()
  }
}