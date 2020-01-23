const mongodb = require('../../../database/mongodb')
const ObjectId = require('mongodb').ObjectId

exports.route = {
  async get({ itemId }) {
    let { cardnum } = this.user
    if (itemId) {
      // 如果指定了事务id，首先获取事务记录
      let record = await this.db.execute(`
      select * 
      from herald_lost_and_found
      where wid = '${itemId}'
    `)
      record = record.rows.map(Element => {
        let [_id, creator, title, lastModifiedTime, describe, imageUrl, type, isAudit, isFinished] = Element
        return { _id, creator, title, lastModifiedTime, describe, imageUrl, type, isAudit, isFinished }
      })[0]
      if (!record) {
        throw '事务不存在'
      }
      if (record.creator !== cardnum) {
        // 如果不是自己创建的就去查找自己发的消息
        // return await messageCollection.find({ itemId, creator: cardnum }, { sort: [['lastModifiedTime', -1]] }).toArray()
        let record = await this.db.execute(`
          SELECT *
          FROM herald_lost_and_found_message
          where ITEMID = '${itemId}' and creator = '${cardnum}'
          ORDER BY LASTMODIFIEDTIME DESC
        `)
        return record.rows.map(Element => {
          let [_id, itemId, message, creator, hasRead, lastModifiedTime] = Element
          return { _id, itemId, message, creator, hasRead, lastModifiedTime }
        })
      }
      // 如果是自己创建的就查找该事务的全部
      // await messageCollection.updateMany({ itemId }, { $set: { hasRead: true } }) // 标记为已读
      await this.db.execute(`
      UPDATE herald_lost_and_found_message
      SET 
      HASREAD = 1
      WHERE ITEMID = '${itemId}'
      `)
      // return await messageCollection.find({ itemId }, { sort: [['lastModifiedTime', -1]] }).toArray()
      record = await this.db.execute(`
      SELECT *
      FROM herald_lost_and_found_message
      where ITEMID = '${itemId}'
      ORDER BY LASTMODIFIEDTIME DESC
    `)
      return record.rows.map(Element => {
        let [_id, itemId, message, creator, hasRead, lastModifiedTime] = Element
        return { _id, itemId, message, creator, hasRead, lastModifiedTime }
      })
    } else {
      // 没有指定 itemId 就要获取一个列表了
      // let items = await lostAndFoundCollection.find({ creator: cardnum, isAudit: true, isFinished: false }, { projection: { '_id': 1 } }).toArray()
      let items = await this.db.execute(`
      select * 
      from herald_lost_and_found
      where creator = '${cardnum}' and isAudit = 1 and isFinished = 0
    `)
      items = items.rows.map(Element => {
        let [_id, creator, title, lastModifiedTime, describe, imageUrl, type, isAudit, isFinished] = Element
        return { _id, creator, title, lastModifiedTime, describe, imageUrl, type, isAudit, isFinished }
      })
      let res = {}
      for (let itemId of items) {
        let result = await this.db.execute(`
        SELECT COUNT(*)
        FROM herald_lost_and_found_message
        where ITEMID = '${itemId._id}' and hasRead = 0
      `)
        res[itemId._id] = result.rows[0][0]
      }
      return res
    }
  },
  async post({ itemId, message }) {
    if (!itemId) {
      throw '未指定事务id'
    }
    if (!message || message.length === 0) {
      throw '不能提交空消息'
    }
    let { cardnum } = this.user
    let record = await this.db.execute(`
    select * 
    from herald_lost_and_found
    where wid = '${itemId}'
  `)
    record = record.rows.map(Element => {
      let [_id, creator, title, lastModifiedTime, describe, imageUrl, type, isAudit, isFinished] = Element
      return { _id, creator, title, lastModifiedTime, describe, imageUrl, type, isAudit, isFinished }
    })[0]
    if (record.isAudit && !record.isFinished) {
      sql = `INSERT INTO herald_lost_and_found_message VALUES (sys_guid(), :1, :2, :3, :4, :5)`;

    binds = [
      [itemId, message, cardnum, 0, +moment()],
    ];

    options = {
      autoCommit: true,

      bindDefs: [
        { type: oracledb.STRING, maxSize: 50 },
        { type: oracledb.STRING, maxSize: 100 },
        { type: oracledb.STRING, maxSize: 20 },
        { type: oracledb.NUMBER },
        { type: oracledb.NUMBER },
      ]
    };
    result = await this.db.executeMany(sql, binds, options);
      return '回复成功'
    } else {
      throw '该事务未通过审核或已被关闭'
    }
  }
}