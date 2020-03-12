exports.route = {
  async get({ id }) {
    if (!id) {
      throw '参数不全'
    }
    let { cardnum } = this.user
    let record = await this.db.execute(`
    SELECT READ_TIME
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
  async post({ id, key }) {
    if (!id) {
      throw '参数不全'
    }
    let cardnum
    if (!key) {
      cardnum = this.user.cardnum
    } else {
      cardnum = this.user.decrypt(key)
    }
    let record = await this.db.execute(`
    SELECT READ_TIME
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
        SET READ_TIME = :readTime
        WHERE CARDNUM = :cardnum AND NOTIFICATION_ID = :id
        `, {
          readTime,
          cardnum,
          id
        })
        await this.post('https://xgbxscwx.seu.edu.cn' + '/api/notification/read', {
          id,
          key: this.user.encrypt(cardnum),
        })
      }
    }
    return '通知查阅成功'
  }
}