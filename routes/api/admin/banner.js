const db = require('../../../database/publicity')

exports.route = {
  async get () {
    if (!this.admin.publicity) {
      throw 403
    }
    return (await db.banner.find()).sort((a, b) => b.startTime - a.startTime)
  },
  async post ({ banner }) {
    if (!this.admin.publicity) {
      throw 403
    }
    await db.banner.insert(banner)
    return 'OK'
  },
  async put ({ banner }) {
    if (!this.admin.publicity) {
      throw 403
    }
    await db.banner.update({ bid: banner.bid }, banner)
    return 'OK'
  },
  async delete ({ bid }) {
    if (!this.admin.publicity) {
      throw 403
    }
    await db.banner.remove({ bid })
    return 'OK'
  }
}
