const oracledb = require('oracledb')
// const JPushKeys = require('../../../sdk/sdk.json').JPush
// const Base64 = require('js-base64').Base64
let secretKey
try {
  secretKey = require('../../../sdk/sdk.json').herald.secretKey
} catch (err) {
  secretKey = ''
}

exports.route = {
  // key 为包括发布者姓名，一卡通，角色，来源的密钥
  // signature 为包括secretKey，发布者姓名，一卡通，角色的密钥
  // 两者比对确定请求正确
  /**
  * @api {POST} /api/notification 新建通知
  * @apiGroup notice
  * 
  * @apiParam {String} notificationId
  * @apiParam {String} title
  * @apiParam {String} content
  * @apiParam {String} tag
  * @apiParam {String} target
  * @apiParam {String} annex
  * @apiParam {String} key
  * @apiParam {String} signature
  * @apiParam {Number} deadline
  */
  async post({ notificationId, title, content, tag, target, annex, key, signature, deadline }) {
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
    try {
      // 将通知存入oracle
      await this.db.execute(`
      INSERT INTO H_NOTIFICATION
      (ID, TITLE, CONTENT, PUBLISHER, PUBLISHTIME, ROLE, TAG, ANNEX, SOURCE, PUBLISHERNAME, DEADLINE)
      VALUES(:notificationId, :title, :content, :cardnum, :time, :role, :tag, :annex, :source, :name, :deadline)
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
        name,
        deadline
      })
    } catch (err) {
      if (err.errorNum === 1) {
        throw '主键重复'
      } else {
        throw err
      }
    }

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

    // // 向app推送通知
    // for (let i = 0; i < target.length; i += 900) {
    //   this.post('https://api.jpush.cn/v3/push', JSON.stringify({
    //     platform: 'all',
    //     audience: {
    //       alias: target.slice(i, i + 900).map(Element => { return Element + JPushKeys.heraldKey })
    //     },
    //     notification: {
    //       android: {
    //         alert: content,// 通知内容
    //         title: title,// 通知标题
    //         extras: {
    //           notificationId
    //         }
    //       },
    //       ios: {
    //         alert: '有一条新的通知~要记得看噢~',
    //         extras: {
    //           notificationId
    //         }
    //       }
    //     }
    //   }), { headers: { 'Authorization': 'Basic ' + Base64.encode(JPushKeys.appKey + ':' + JPushKeys.masterSecret) } })
    // }
    return '推送成功'
  },

  /**
   * 获取通知列表以及获取通知详情
   * @param {String}    id          通知id
   * @param {String}    page        页数
   * @param {String}    pageSize    页大小
   * 
   * id 和 page, pageSize 不能同时存在
   */

  /**
  * @api {GET} /api/notification 获取通知
  * @apiGroup notice
  * 
  * @apiParam {String} id
  * @apiParam {Number} page
  * @apiParam {Number} pageSize
  */
  async get({ id, page = 1, pageSize = 10 }) {

    // 计算起始和终止条目index,闭区间
    let startIndex = (+page - 1) * + pageSize
    let endIndex = +page * +pageSize - 1
    // console.log(endIndex)
    // 未指定id则查看列表
    if (!id) {
      let { cardnum } = this.user
      let count = await this.db.execute(`
      SELECT COUNT (*)
      FROM (
        SELECT NOTIFICATION_ID, READTIME
        FROM H_NOTIFICATION_ISREAD
        WHERE CARDNUM = :cardnum 
      )A
        LEFT JOIN H_NOTIFICATION
        ON H_NOTIFICATION.ID = A.NOTIFICATION_ID 
      `, {
        cardnum
      })
      // console.log(count.rows[0][0])
      const hasMore = endIndex + 1 < count.rows[0][0]
      // 查看列表
      /**
       * 分页返回的策略：
       * 优先返回「未读取」的通知, 剩余的用「读取过」的通知填充
       * 通知按照时间顺序返回, PUBLISHTIME 越大, index 越小
       */
      // 查询我收到的未读通知
      let unReadRecord = await this.db.execute(`
      SELECT H_NOTIFICATION.ID, TITLE, CONTENT, PUBLISHERNAME, PUBLISHTIME, ROLE, TAG, ANNEX, SOURCE, DEADLINE, A.READTIME
      FROM (
        SELECT NOTIFICATION_ID, READTIME
        FROM H_NOTIFICATION_ISREAD
        WHERE CARDNUM = :cardnum AND READTIME IS NULL
      )A
        LEFT JOIN H_NOTIFICATION
        ON H_NOTIFICATION.ID = A.NOTIFICATION_ID ORDER BY PUBLISHTIME DESC
      `, {
        cardnum
      })
      let unReadCount = unReadRecord.rows.length
      // 接下来根据「未读通知」的数量分页查询「已读通知」
      if (unReadCount >= endIndex + 1) {
        let ret = unReadRecord.rows.slice(startIndex, endIndex + 1).map(item => {
          let [notificationId, title, content, publisher, publishTime, role, tag, annex, source, deadline, readTime] = item
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
            deadline,
            isRead: readTime === null ? false : true,
            readTime
          }
        })
        return {
          list: ret,
          hasMore
        }
      }
      if ((unReadCount >= (startIndex + 1)) && (unReadCount < (endIndex + 1))) {
        endIndex = endIndex - (unReadCount - startIndex)
        let hasReadRecord = await this.db.execute(/*sql*/`
        SELECT ID, TITLE, CONTENT, PUBLISHERNAME, PUBLISHTIME, ROLE, TAG, ANNEX, SOURCE, DEADLINE, READTIME
          FROM (SELECT tt.*, ROWNUM AS rowno
            FROM (
              SELECT H_NOTIFICATION.ID, TITLE, CONTENT, PUBLISHERNAME, PUBLISHTIME, ROLE, TAG, ANNEX, SOURCE, DEADLINE, A.READTIME
                FROM (
                  SELECT NOTIFICATION_ID, READTIME
                  FROM H_NOTIFICATION_ISREAD
                  WHERE CARDNUM = :cardnum AND READTIME IS NOT NULL
                ) A
              LEFT JOIN H_NOTIFICATION
              ON H_NOTIFICATION.ID = A.NOTIFICATION_ID ORDER BY PUBLISHTIME DESC
            ) tt
            WHERE ROWNUM <= :endRow
          ) table_alias
        WHERE table_alias.rowno >= :startRow
        `, {
          cardnum,
          endRow: endIndex + 1 - startIndex,
          startRow: 1
        })

        let ret = unReadRecord.rows.slice(startIndex).concat(hasReadRecord.rows).map(item => {
          let [notificationId, title, content, publisher, publishTime, role, tag, annex, source, deadline, readTime] = item
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
            deadline,
            isRead: readTime === null ? false : true,
            readTime
          }
        })
        return {
          list: ret,
          hasMore
        }

      }
      if (unReadCount < (startIndex + 1)) {
        let hasReadRecord = await this.db.execute(/*sql*/`
        SELECT ID, TITLE, CONTENT, PUBLISHERNAME, PUBLISHTIME, ROLE, TAG, ANNEX, SOURCE, DEADLINE ,READTIME
          FROM (SELECT tt.*, ROWNUM AS rowno
            FROM (
              SELECT H_NOTIFICATION.ID, TITLE, CONTENT, PUBLISHERNAME, PUBLISHTIME, ROLE, TAG, ANNEX, SOURCE, DEADLINE, A.READTIME
                FROM (
                  SELECT NOTIFICATION_ID, READTIME
                  FROM H_NOTIFICATION_ISREAD
                  WHERE CARDNUM = :cardnum AND READTIME IS NOT NULL
                ) A
              LEFT JOIN H_NOTIFICATION
              ON H_NOTIFICATION.ID = A.NOTIFICATION_ID ORDER BY PUBLISHTIME DESC
            ) tt
            WHERE ROWNUM <= :endRow
          ) table_alias
        WHERE table_alias.rowno >= :startRow
        `, {
          cardnum,
          endRow: endIndex + 1 - unReadCount,
          startRow: startIndex + 1 - unReadCount
        })

        let ret = unReadRecord.rows.slice(startIndex).concat(hasReadRecord.rows).map(item => {
          let [notificationId, title, content, publisher, publishTime, role, tag, annex, source, deadline, readTime] = item
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
            deadline,
            isRead: readTime === null ? false : true,
            readTime
          }
        })
        return {
          list: ret,
          hasMore
        }
      }

    } else {
      // 指定id
      let record = await this.db.execute(`
      SELECT H_NOTIFICATION.ID, TITLE, CONTENT, PUBLISHERNAME, PUBLISHTIME, ROLE, TAG, ANNEX, SOURCE, DEADLINE, A.READTIME
      FROM (
        SELECT NOTIFICATION_ID, READTIME
        FROM H_NOTIFICATION_ISREAD
        WHERE NOTIFICATION_ID = :id AND CARDNUM = :cardnum
      )A
        LEFT JOIN H_NOTIFICATION
        ON H_NOTIFICATION.ID = A.NOTIFICATION_ID
      `, { id, cardnum: this.user.cardnum })

      // 此处返回的是object不是array
      let ret = record.rows.map(Element => {
        let [notificationId, title, content, publisher, publishTime, role, tag, annex, source, deadline, readTime] = Element
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
          deadline,
          isRead: readTime === null ? false : true,
          readTime
        }
      })

      return ret[0] ? ret[0] : {}
    }
  },
}