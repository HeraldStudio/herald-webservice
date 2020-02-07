const uuid = require('uuid/v4')
const sha1 = require('sha1')
const { wechat } = require('../../sdk/sdk.json')

/**
 * 微信认证路由
 */
exports.route = {
  async get() {
    // 用于微信测试，正确响应微信发送的Token验证
    const { signature, timestamp, nonce, echostr } = this.request.query
    const array = [wechat['wx-herald'].token, nonce, timestamp].sort()
    if (signature === sha1(array[0] + array[1] + array[2])) {
      this.body = echostr
      this.wechatTest = true
    }
  },

  async post() {
    // 微信的用户绑定是很重要的操作，必须检查绑定的请求是否来自微信
    const { signature, timestamp, nonce } = this.request.query
    const array = [wechat['wx-herald'].token, nonce, timestamp].sort()
    if (signature !== sha1(array[0] + array[1] + array[2])) {
      throw '很遗憾你不是来自微信的请求，我拒绝响应'
    }

    try {
      this.user.cardnum
      // 已绑定
      return '已经绑定'
    } catch (err) {
      // 没有绑定
      console.log('未绑定')

      // 先删除以前的openid和sessionid记录
      await this.db.execute(`
      DELETE TOMMY.H_OPENID_AND_TOKEN WHERE OPENID = :openid
      `, {
        openid: this.openid
      })

      const sessionid = uuid()

      // 再新建一个openid和sessionid的记录
      await this.db.execute(`
      INSERT INTO TOMMY.H_OPENID_AND_TOKEN 
      (OPENID, TOKEN, SESSIONID, CARDNUM) 
      VALUES (:openid, :token, :sessionid, :cardnum)
      `, {
        openid: this.openid,
        token: 'fake',
        sessionid,
        cardnum: 'fake'
      })

      return sessionid

    }

  }
}