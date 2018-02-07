/**
 * Created by WolfTungsten on 2018/2/7.
 */

const axios = require('axios')
const qs = require('querystring')
const sdk_config = require('./sdk_config.json')


const apikey = sdk_config.yunpian.apikey
const baseURL = sdk_config.yunpian.baseUrl
let _axios = axios.create({

  baseURL:baseURL,
  // 默认使用 URLEncoded 方式编码请求
  transformRequest(req) {
    if (typeof req === 'object') {
      return qs.stringify(req)
    }
    return req
  },
  headers:{
    'Accept' : 'application/json;charset=utf-8;',
    'Content-Type' : 'application/x-www-form-urlencoded;charset=utf-8;'
  }

})

//单发短信
let sendSMS = (mobile, text) => {
  if (typeof mobile === 'string') {
    // 单发
    let body = {apikey, mobile, text}
    const url = '/sms/single_send.json'
    _axios.post(url, body)
  } else {
    // 群发
    if (mobile.length >= 1000) {
      throw {message:'单次群发短信不得超过1000条'}
    }
    mobile = mobile.join(',')
    let body = { apikey, mobile, text}
    const url = '/sms/batch_send.json'
    _axios.post(url, body)
  }
}

//模版发送
let templateSMS = {
  spiderToken(mobile, spiderName, spiderToken){
    let text = `【小猴偷米后台监控】分布式客户端 ${spiderName} 请求连接认证，认证密钥 ${spiderToken}`
    sendSMS(mobile, text)
  }
}

module.exports = templateSMS

