const {adminList} = require('./admin.json')

exports.route = {
  async post({itemId}){
    let {cardnum} = this.user
    let record = await this.db.execute(`
    select * 
    from herald_lost_and_found
    where wid = '${itemId}'
  `)
    record = record.rows.map(Element => {
      let [_id, creator, title, lastModifiedTime, describe, imageUrl, type, isAudit, isFinished] = Element
      return { _id, creator, title, lastModifiedTime, describe, imageUrl, type, isAudit, isFinished }
    })[0]
    if([record.creator, ...adminList].indexOf(cardnum) === -1){
      throw 401
    }
    await this.db.execute(`
    UPDATE herald_lost_and_found
    SET 
    ISFINISHED = 1
    WHERE wid = '${itemId}'
    `)
    return 'success'
  }
}