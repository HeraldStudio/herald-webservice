const { db, isAdmin } = require('./db')

exports.route = {

  /**
   * GET /api/canteen/canteen
   * 获取所有食堂信息
   **/
  async get() {
    return await db.all('select * from canteen')
  }

  /**
   * POST /api/canteen/canteen
   * 管理员添加食堂
   * @apiParam JSON {
   *   canteen: {
   *     name,
   *     open_time_am, close_time_am,
   *     open_time_pm, close_time_pm,
   *     manager, manager_contact,
   *     quanyi_contact,
   *     comment
   *   }
   * }
   **/
  async post() {
    let { cardnum } = this.user
    if (!isAdmin(cardnum)) { throw 403 }

    let { canteen } = this.params
    let {
      cid,
      name,
      open_time_am,
      close_time_am,
      open_time_pm,
      close_time_pm,
      manager,
      manager_contact,
      quanyi_contact,
      comment
    } = canteen

    await db.run(`insert into canteen (
      name,
      open_time_am,
      close_time_am,
      open_time_pm,
      close_time_pm,
      manager,
      manager_contact,
      quanyi_contact,
      comment
    ) values (
      ?, ?, ?, ?, ?, ?, ?, ?, ?
    )`, [
      name,
      open_time_am,
      close_time_am,
      open_time_pm,
      close_time_pm,
      manager,
      manager_contact,
      quanyi_contact,
      comment
    ])
  },

  /**
   * PUT /api/canteen/canteen
   * 管理员修改食堂信息
   * @apiParam JSON {
   *   canteen: {
   *     cid, name,
   *     open_time_am, close_time_am,
   *     open_time_pm, close_time_pm,
   *     manager, manager_contact,
   *     quanyi_contact,
   *     comment
   *   }
   * }
   **/
  async put() {
    let { cardnum } = this.user
    if (!isAdmin(cardnum)) { throw 403 }

    let { canteen } = this.params
    let {
      cid,
      name,
      open_time_am,
      close_time_am,
      open_time_pm,
      close_time_pm,
      manager,
      manager_contact,
      quanyi_contact,
      comment
    } = canteen

    await db.run(`update canteen set
      name = ?,
      open_time_am = ?,
      close_time_am = ?,
      open_time_pm = ?,
      close_time_pm = ?,
      manager = ?,
      manager_contact = ?,
      quanyi_contact = ?,
      comment = ?
    where
      cid = ?
    `, [
      name,
      open_time_am,
      close_time_am,
      open_time_pm,
      close_time_pm,
      manager,
      manager_contact,
      quanyi_contact,
      comment,
      cid
    ])
  },

  /**
   * DELETE /api/canteen/canteen
   * 管理员删除食堂
   * @apiParam cid
   **/
  async put() {
    let { cardnum } = this.user
    if (!isAdmin(cardnum)) { throw 403 }

    let { cid } = this.params
    await db.run('delete from canteen where cid = ?', [cid])
  }
}
