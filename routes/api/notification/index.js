const oracledb = require('oracledb')
const JPushKeys = require('../../../sdk/sdk.json').JPush
const Base64 = require('js-base64').Base64
exports.route = {
  async post({ title, content, tag, target, annex, role, cardnum, source }) {
    if (!(title && content)) {
      throw '参数不全'
    }
    if (title.length > 60) {
      throw '标题过长'
    }
    if (content.length > 1200) {
      throw '内容过长'
    }
    if (!role) {
      throw 403
    }
    let isAll = false
    let time = +moment()
    if (target === 'all') {
      isAll = true
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
      (TITLE, CONTENT, PUBLISHER, PUBLISHTIME, ROLE, TAG, ANNEX, SOURCE)
      VALUES(:title, :content, :cardnum, :time, :role, :tag, :annex, :source)
      `, {
      title,
      content,
      cardnum,
      time,
      role,
      tag,
      annex,
      source
    })
    // 获取通知的 guid
    let record = await this.db.execute(`
    SELECT ID 
    FROM H_NOTIFICATION
    WHERE TITLE = :title AND PUBLISHTIME = :time
    `, {
      title,
      time
    })
    let notificationId = record.rows[0][0]

    // 插入与接受者的绑定记录
    const sql = 'INSERT INTO H_NOTIFICATION_ISREAD VALUES (:notificationId, :cardnum)'

    let binds = target.map(Element => {
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

    // 向app推送通知
    if (isAll) {
      this.post('https://api.jpush.cn/v3/push', {
        platform: 'all',
        audience: 'all',
        notification: {
          android: {
            alert: '',// 通知内容
            title: '',// 通知标题
            intent: {
              url: ''// 跳转
            }
          },
          ios: {
            alert: '有一条新的通知~要记得看噢~'
          }
        }
      }, { headers: { 'Authorization': Base64.encode(JPushKeys.appKey + ':' + JPushKeys.masterSecret) } })
    } else {
      for (let i = 0; i < target.length; i += 900) {
        this.post('https://api.jpush.cn/v3/push', {
          platform: 'all',
          audience: {
            alias: target.slice(i, i + 900)
          },
          notification: {
            android: {
              alert: '',// 通知内容
              title: '',// 通知标题
              intent: {
                url: ''// 跳转
              }
            },
            ios: {
              alert: '有一条新的通知~要记得看噢~'
            }
          }
        }, { headers: { 'Authorization': Base64.encode(JPushKeys.appKey + ':' + JPushKeys.masterSecret) } })
      }

    }
    return '推送成功'
  }
}