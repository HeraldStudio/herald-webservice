const db = require('../../database/publicity')

exports.route = {

  /**
   * GET /api/admin/publicity
   * 获取所有内容（轮播图/通知/活动）
   * @apiParam type banner/notice/activity
   **/
  async get () {
    if (!this.admin.publicity) {
      throw 403
    }
    let { type, page, pagesize } = this.params
    page = page || 0
    pagesize = pagesize || 20
    return await db.publicity.find({ type }, pagesize, pagesize * page)
  },

  /**
   * POST /api/admin/publicity
   * 新增内容（轮播图/通知/活动）
   * @apiParam { publicity }
   **/
  async post () {
    if (!this.admin.publicity) {
      throw 403
    }
    let { publicity } = this.params
    await db.publicity.insert(publicity)
  },

  /**
   * PUT /api/admin/publicity
   * 修改内容（轮播图/通知/活动）
   **/
  async put () {
    if (!this.admin.publicity) {
      throw 403
    }
    let { publicity } = this.params
    await db.publicity.update({ pid: publicity.pid }, publicity)
  },

  /**
   * DELETE /api/admin/publicity
   * 删除内容（轮播图/通知/活动）
   * @apiParam pid
   **/
  async delete () {
    if (!this.admin.publicity) {
      throw 403
    }
    let { pid } = this.params
    await db.publicity.remove({ pid })
  }
}
