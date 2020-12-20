/**
 * 该中间件基于腾讯云「TPNS」推送服务实现
 * docs: https://cloud.tencent.com/document/product/548
 */
const { url, android, ios } = require('../sdk/sdk.json').tpns
const axios = require('axios')
const crypto = require('crypto')
const generateSign = (config, timestamp, requestBody) => {
  return Buffer.from(crypto.createHmac('sha256', config.secretKey)
    .update(timestamp + config.accessID + requestBody).digest('hex')).toString('base64')
}

module.exports = async (ctx, next) => {
  ctx.tpns = {
    /**
     * 基础推送接口，message 至少需包含title，content 两个字段
     */
    async push(account_list, message) {
      if (!(message.title && message.content)) {
        throw 'message字段不全'
      }

      // 安卓推送体
      const androidBody = JSON.stringify({
        audience_type: 'account',
        account_list,
        message_type: 'notify',
        message
      })
      // iOS推送体
      const iosBody = JSON.stringify({
        audience_type: 'account',
        account_list,
        message_type: 'notify',
        message
      })
      const now = moment().format('X')

      
    }
  }
}