/**
 * wx-herald 小猴偷米微信公众号中间件
 */
const wechat = require('co-wechat')
const config = require('../../sdk/sdk.json').wechat['wx-herald']

// 微信后台配置中，用 appsecret 来填写 token 和 encodingAESKey
config.token = config.encodingAESKey = config.appsecret

module.exports = wechat(config).middleware(async (message, ctx) => {
  return 'Hello, World! 小猴偷米微信服务号施工中~'
})