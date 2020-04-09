/**
 * @apiDefine lostAndFound 失物招领/寻物启事
 */
exports.route = {
  /**
  * @api {POST} /api/lostAndFound/audit 审核失物招领/寻物启事
  * @apiGroup lostAndFound
  * 
  * @apiParam {String} id
  * @apiParam {Boolean} pass
  */
  async post({ id, pass }) {
    if (!(await this.hasPermission('publicity'))) {
      throw 403
    }
    if (pass) {
      await this.db.execute(`
      UPDATE H_LOST_AND_FOUND
      SET 
      ISAUDIT = 1,
      ISFINISHED = 0
      WHERE wid = :id
      `, { id })
    } else {
      await this.db.execute(`
      UPDATE H_LOST_AND_FOUND
      SET 
      ISAUDIT = 0,
      ISFINISHED = 1
      WHERE wid = :id
      `, { id })
    }
    return 'success'
  }
}