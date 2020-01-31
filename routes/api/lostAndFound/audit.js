exports.route = {
  /**
   * POST /api/lostAndFound/audit
   * @param { id, pass } 
   * 审核接口
   */
  async post({id, pass}){
    if (!(await this.hasPermission('publicity'))) {
      throw 403
    }
    if(pass){
      await this.db.execute(`
      UPDATE H_LOST_AND_FOUND
      SET 
      ISAUDIT = 1,
      ISFINISHED = 0
      WHERE wid = '${id}'
      `)
    } else {
      await this.db.execute(`
      UPDATE H_LOST_AND_FOUND
      SET 
      ISAUDIT = 0,
      ISFINISHED = 1
      WHERE wid = '${id}'
      `)
    }
    return 'success'
  }
}