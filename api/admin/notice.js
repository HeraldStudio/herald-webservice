const db = require('../../database/publicity')

exports.route = {
  async get () {
    if (!this.admin.maintenance) {
      throw 403
    }
    return (await db.notice.find()).sort((a, b) => b.nid - a.nid)
  },
  async post () {
    if (!this.admin.maintenance) {
      throw 403
    }
    let { notice } = this.params
    await db.notice.insert(notice)
  },
  async put () {
    if (!this.admin.maintenance) {
      throw 403
    }
    let { notice } = this.params
    await db.notice.update({ nid: notice.nid }, notice)
  },
  async delete () {
    if (!this.admin.maintenance) {
      throw 403
    }
    let { nid } = this.params
    await db.notice.remove({ nid })
  }
}
