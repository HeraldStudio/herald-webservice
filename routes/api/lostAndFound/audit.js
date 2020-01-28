const {adminList} = require('./admin.json')

exports.route = {
  /**
   * POST /api/lostAndFound/audit
   * @param { id, pass } 
   * 审核接口
   */
  async post({id, pass}){
    let {cardnum} = this.user
    if(adminList.indexOf(cardnum) === -1) {
      throw 401
    }
    if(pass){
      await this.db.execute(`
      UPDATE herald_lost_and_found
      SET 
      ISAUDIT = 1,
      ISFINISHED = 0
      WHERE wid = '${id}'
      `)
    } else {
      await this.db.execute(`
      UPDATE herald_lost_and_found
      SET 
      ISAUDIT = 1,
      ISFINISHED = 0
      WHERE wid = '${id}'
      `)
    }
    return 'success'
  }
}