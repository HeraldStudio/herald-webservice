const { adminList } = require('./admin.json')

exports.route = {
  /**
  * @api {POST} /api/lostAndFound/success 失物招领/寻物启事结项
  * @apiGroup lostAndFound
  * 
  * @apiParam {String} id
  */
  async post({ id }) {
    let { cardnum } = this.user
    let record = await this.db.execute(`
    select * 
    from H_LOST_AND_FOUND
    where wid = :id
  `, { id })
    record = record.rows.map(Element => {
      let [_id, creator, title, lastModifiedTime, describe, imageUrl, type, isAudit, isFinished] = Element
      return { _id, creator, title, lastModifiedTime, describe, imageUrl, type, isAudit, isFinished }
    })[0]
    if ([record.creator, ...adminList].indexOf(cardnum) === -1) {
      throw 401
    }
    if (!record) {
      throw "无此项"
    }
    if (record.isFinished === 1) {
      throw "非法操作"
    }
    await this.db.execute(`
    UPDATE H_LOST_AND_FOUND
    SET 
    ISFINISHED = 1
    WHERE wid = :id
    `, { id })
    return 'success'
  }
}