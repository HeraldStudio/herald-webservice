const { db, isAdmin } = require('./db')

exports.route = {

  /**
   * GET /api/canteen/window
   * 查询窗口
   **/
  async get() {
    let { wid, cid, keyword, page, pagesize } = this.params

    // 获取具体某个窗口详情
    if (wid) {
      let result = await db.get('select * from window where wid = ?', [wid])
      if (result) {
        return result
      } else {
        throw 404
      }
    }

    // 模糊查询
    let conditions = [], values = []

    if (cid) {
      conditions.push('cid = ?')
      values.push(cid)
    }

    if (keyword) {
      conditions.push('name like ? or floor like ? or comment like ?')
      keyword = '%' + keyword + '%'
      values.push(keyword, keyword, keyword)
    }

    conditions = conditions.join(' and ')
    if (conditions) {
      conditions = ' where ' + conditions
    }

    // 查询并组装结果
    page = parseInt(page || 1)
    pagesize = parseInt(pagesize || 10)

    let count = (await db.get('select count(*) from window ' + conditions))['count(*)']

    let result = await db.all(
      'select * from window ' + conditions + ' limit ? offset ?',
      values.concat([ pagesize, (page - 1) * pagesize ])
    )

    return {
      result, pages: Math.ceil(count / pagesize)
    }
  },

  /**
   * POST /api/canteen/window
   * 管理员添加窗口
   **/
  async post() {
    let { cardnum } = this.user
    if (!isAdmin(cardnum)) { throw 403 }

    let { window } = this.params
    let { cid, floor, name, pic, comment } = window

    await db.run(`insert into window (
      cid,  floor,  name, pic,  comment
    ) values (
      ?,    ?,      ?,    ?,    ?
    )`, [
      cid,  floor,  name, pic,  comment
    ])
  },

  /**
   * PUT /api/canteen/window
   * 管理员修改窗口
   **/
  async put() {
    let { cardnum } = this.user
    if (!isAdmin(cardnum)) { throw 403 }

    let { window } = this.params
    let { wid, cid, floor, name, pic, comment } = window

    await db.run(`update window set
      cid = ?,
      floor = ?,
      name = ?,
      pic = ?,
      comment = ?
    where
      wid = ?
    `, [
      cid, floor, name, pic, comment, wid
    ])
  },

  /**
   * DELETE /api/canteen/window
   * 管理员删除窗口
   **/
  async delete() {
    let { cardnum } = this.user
    if (!isAdmin(cardnum)) { throw 403 }

    let { wid } = this.params

    await db.run(`delete from window where wid = ?`, [wid])
  }
}
