const oracledb = require('oracledb')
const JPushKeys = require('../../../sdk/sdk.json').JPush
const Base64 = require('js-base64').Base64
const secretKey = require('../../../sdk/sdk.json').herald.secretKey
exports.route = {
  // key 为包括发布者姓名，一卡通，角色，来源的密钥
  // signature 为包括secretKey，发布者姓名，一卡通，角色的密钥
  // 两者比对确定请求正确
  async post({ notificationId, title, content, tag, target, annex, key, signature }) {
    if (!(notificationId && title && content && target && key && signature)) {
      throw '参数不全'
    }
    if (title.length > 60 || content.length > 1200 || annex.length > 500 || tag.length > 100) {
      throw '参数过长'
    }
    // 解码鉴权
    key = JSON.parse(this.user.decrypt(key))
    signature = JSON.parse(this.user.decrypt(signature))
    if (signature.secretKey !== secretKey ||
      key.name !== signature.name ||
      key.cardnum !== signature.cardnum ||
      key.role !== signature.role) {
      throw '非法操作'
    }
    let { cardnum, name, role, source } = key
    let time = +moment()
    if (target === 'all') {
      let record = await this.db.execute(`
      SELECT DISTINCT(CARDNUM)
      FROM H_AUTH 
      WHERE PLATFORM LIKE '%app%'
      `)
      target = record.rows.map(Element => {
        let [cardnum] = Element
        return cardnum
      })
    }
    // 将通知存入oracle
    await this.db.execute(`
      INSERT INTO H_NOTIFICATION
      (ID, TITLE, CONTENT, PUBLISHER, PUBLISHTIME, ROLE, TAG, ANNEX, SOURCE, PUBLISHERNAME)
      VALUES(:notificationId, :title, :content, :cardnum, :time, :role, :tag, :annex, :source, :name)
      `, {
      notificationId,
      title,
      content,
      cardnum,
      time,
      role,
      tag,
      annex,
      source,
      name
    })
    // 为了处理在target仅有一位时，数组退化为字符串的现象
    if (typeof target !== 'object') {
      target = [target]
    }
    // 插入与接受者的绑定记录
    for (let i = 0; i < target.length; i += 900) {
      let cardnums = target.slice(i, i + 900)
      const sql = 'INSERT INTO H_NOTIFICATION_ISREAD （NOTIFICATION_ID, CARDNUM） VALUES (:notificationId, :cardnum)'

      let binds = cardnums.map(Element => {
        return {
          notificationId,
          cardnum: Element
        }
      })
      const options = {
        autoCommit: true,
        bindDefs: {
          notificationId: { type: oracledb.STRING, maxSize: 40 },
          cardnum: { type: oracledb.STRING, maxSize: 10 }
        }
      }
      await this.db.executeMany(sql, binds, options)
    }

    // 向app推送通知
    for (let i = 0; i < target.length; i += 900) {
      this.post('https://api.jpush.cn/v3/push', JSON.stringify({
        platform: 'all',
        audience: {
          alias: target.slice(i, i + 900).map(Element => { return Element + JPushKeys.heraldKey })
        },
        notification: {
          android: {
            alert: content,// 通知内容
            title: title,// 通知标题
            extras: {
              notificationId
            }
          },
          ios: {
            alert: '有一条新的通知~要记得看噢~',
            extras: {
              notificationId
            }
          }
        }
      }), { headers: { 'Authorization': 'Basic ' + Base64.encode(JPushKeys.appKey + ':' + JPushKeys.masterSecret) } })
    }
    return '推送成功'
  },

  async get({ id }) {
    // 未指定id则查看列表
    if (!id) {
      // 查询我收到的通知
      let { cardnum } = this.user
      let record = await this.db.execute(`
      SELECT H_NOTIFICATION.ID, TITLE, CONTENT, PUBLISHERNAME, PUBLISHTIME, ROLE, TAG, ANNEX, SOURCE, A.READ_TIME
      FROM (
        SELECT NOTIFICATION_ID, READ_TIME
        FROM H_NOTIFICATION_ISREAD
        WHERE CARDNUM = :cardnum
      )A
        LEFT JOIN H_NOTIFICATION
        ON H_NOTIFICATION.ID = A.NOTIFICATION_ID
      `, {
        cardnum
      })
      return record.rows.map(Element => {
        let [notificationId, title, content, publisher, publishTime, role, tag, annex, source, readTime] = Element
        return {
          notificationId,
          title,
          content,
          publisher,
          publishTime,
          role,
          tag,
          annex,
          source,
          isRead: readTime === null ? false : true,
          readTime
        }
      })
    } else {
      let record = await this.db.execute(`
      SELECT TITLE, CONTENT, PUBLISHER, PUBLISHERNAME, PUBLISHTIME, ROLE, TAG, ANNEX, SOURCE
      FROM H_NOTIFICATION
      WHERE ID = :id
      `, { id })
      if (record.rows.length === 0) {
        throw '没有您想要查看的通知'
      }
      record = record.rows.map(Element => {
        let [title, content, publisher, publisherName, publishTime, role, tag, annex, source] = Element
        return { title, content, publisher, publisherName, publishTime, role, tag, annex, source }
      })[0]

      return {
        title: record.title,
        content: record.content,
        publisherName: record.publishName,
        publishTime: record.publishTime,
        role: record.role,
        tag: record.tag,
        annex: record.annex,
        source: record.source
      }
    }
  },
}