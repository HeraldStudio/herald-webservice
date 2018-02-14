const qs = require('querystring')
const config = require('./sdk.json')
const { apikey, baseURL } = config.yunpian
const axios = require('axios').create ({
  baseURL,
  transformRequest(req) {
    if (typeof req === 'object') {
      return qs.stringify(req)
    }
    return req
  },
  headers: {
    'Accept': 'application/json;charset=utf-8;',
    'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8;'
  }
})

let sendSMS = async (mobile, text) => {
  if (typeof mobile === 'string') { // 单发
    await axios.post('/sms/single_send.json', { apikey, mobile, text })
  } else { // 群发
    if (mobile.length >= 1000) {
      throw '单次群发短信不得超过1000条'
    }
    mobile = mobile.join(',')
    await axios.post('/sms/batch_send.json', { apikey, mobile, text })
  }
}

module.exports = {
  async spiderToken (mobile, spiderName, spiderToken) {
    let text = `【小猴偷米后台监控】分布式客户端 ${spiderName} 请求连接认证，认证密钥 ${spiderToken}`
    await sendSMS (mobile, text)
  }
}
