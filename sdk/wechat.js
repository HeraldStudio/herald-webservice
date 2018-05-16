const { config } = require('../app')
const axios = require('axios').create({
  baseURL: 'https://api.weixin.qq.com/cgi-bin/',
  ...config.axios
})
const { wechat } = require('./sdk.json')
const lastToken = {}

const getToken = async (type) => {
  let { token, expire = 0 } = lastToken[type] || {}
  let now = +moment()
  if (expire > now) {
    return token
  }

  let { data: { access_token, expires_in }} = await axios.get(
    '/token?grant_type=client_credential' +
    `&appid=${wechat[type].appid}&secret=${wechat[type].appsecret}`
  )
  if (!access_token) {
    throw '接口调用失败' // 可能是当前 IP 不在白名单，需要管理员到公众号后台添加当前服务器或测试机 IP 到白名单
  }
  lastToken[type] = {
    token: access_token,

    // 这里使用请求开始前的时间戳计算过期时间，这样比较保险
    // 因为微信服务器是从收到请求时开始计算过期时长的，这样算可以让服务器上的过期时间比微信稍早一点
    expire: now + expires_in * 1000
  }
  return access_token
}

const getAxios = (type) => {
  let ret = {}
  'get,post,put,delete'.split(',').map(k => {
    ret[k] = async (path, ...args) => {
      let token = await getToken(type)
      path = path.split('#')
      path[0] += (~path.indexOf('?') ? '&' : '?') + 'access_token=' + token
      path = path.join('#')
      return await axios[k](path, ...args)
    }
  })
  return ret
}

module.exports = {
  getToken, getAxios
}