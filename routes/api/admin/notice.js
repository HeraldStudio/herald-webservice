const db = require('../../../database/publicity')

exports.route = {
  async get () {
    if (!this.admin || !this.admin.maintenance) {
      throw 403
    }
    return (await db.notice.find()).sort((a, b) => b.nid - a.nid)
  },
  async post ({ notice }) {
    if (!this.admin || !this.admin.maintenance) {
      throw 403
    }
    notice.publishTime = +moment()
    await db.notice.insert(notice)
    return 'OK'
  },
  async put ({ notice }) {
    if (!this.admin || !this.admin.maintenance) {
      throw 403
    }
    await db.notice.update({ nid: notice.nid }, notice)
    return 'OK'
  },
  async delete ({ nid }) {
    if (!this.admin || !this.admin.maintenance) {
      throw 403
    }
    await db.notice.remove({ nid })
    return 'OK'
  }
}
