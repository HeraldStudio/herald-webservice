const db = require('./db')

exports.route = {

  /**
   * GET /api/canteen/canteen
   * 获取所有食堂信息
   **/
  async get() {
    return await db.canteen.find()
  },

  /**
   * POST /api/canteen/canteen
   * 管理员添加食堂
   * @apiParam JSON { canteen }
   **/
  async post() {
    if (!this.admin.canteen) { throw 403 }
    let { canteen } = this.params
    await db.canteen.insert(canteen)
  },

  /**
   * PUT /api/canteen/canteen
   * 管理员修改食堂信息
   * @apiParam JSON { canteen }
   **/
  async put() {
    if (!this.admin.canteen) { throw 403 }
    let { canteen } = this.params
    let { cid } = canteen
    await db.canteen.update({ cid }, canteen)
  },

  /**
   * DELETE /api/canteen/canteen
   * 管理员删除食堂
   * @apiParam cid
   **/
  async delete() {
    if (!this.admin.canteen) { throw 403 }
    let { cid } = this.params
    await db.canteen.remove({ cid })
  }
}
