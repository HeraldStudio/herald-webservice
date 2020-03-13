const secretKey = require('../../../../sdk/sdk.json').herald.secretKey
exports.route = {
  async get({ id }) {
    if (!id) {
      throw '参数不全'
    }
    let { cardnum } = this.user
    let record = await this.db.execute(`
    SELECT READTIME
    FROM H_NOTIFICATION_ISREAD
    WHERE NOTIFICATION_ID = :id AND CARDNUM = :cardnum
    `, {
      id,
      cardnum
    })
    if (record.rows.length === 0) {
      throw '没有您想要查看的通知'
    } else {
      let readTime = record.rows[0][0]
      return {
        isRead: readTime === null ? false : true,
        readTime
      }
    }
  },
  async post({ id, key, signature }) {
    if (!id) {
      throw '参数不全'
    }
    if((key || signature)&& !(key && signature)){
      throw '参数不符合规范'
    }
    let cardnum, name
    if (!key) {
      cardnum = this.user.cardnum
      name = this.user.name
      let key = {
        name,
        cardnum,
        source: 'xsc_webservice'
      }
      let signature = {
        secretKey,
        name,
        cardnum
      }
      await this.post('https://xgbxscwx.seu.edu.cn' + '/api/notification/read', {
        id,
        key: this.user.encrypt(JSON.stringify(key)),
        signature: this.user.encrypt(JSON.stringify(signature))
      })
    } else {
      key = JSON.parse(this.user.decrypt(key))
      signature = JSON.parse(this.user.decrypt(signature))
      if(key.cardnum!==signature.cardnum || key.name !== signature.name || signature.secretKey !== secretKey){
        throw '非法操作'
      }
      cardnum = key.cardnum
    }
    let record = await this.db.execute(`
    SELECT READTIME
    FROM H_NOTIFICATION_ISREAD
    WHERE NOTIFICATION_ID = :id AND CARDNUM = :cardnum
    `, {
      id,
      cardnum
    })
    if (record.rows.length === 0) {
      throw '没有您想要查看的通知'
    } else {
      let readTime = record.rows[0][0]
      if (readTime !== null) {
        throw '该通知已阅'
      } else {
        readTime = +moment()
        await this.db.execute(`
        UPDATE H_NOTIFICATION_ISREAD
        SET READTIME = :readTime
        WHERE CARDNUM = :cardnum AND NOTIFICATION_ID = :id
        `, {
          readTime,
          cardnum,
          id
        })
      }
    }
    return '通知查阅成功'
  }
}