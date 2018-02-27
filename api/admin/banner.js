const db = require('../../database/publicity')

exports.route = {
  async get () {
    if (!this.admin.publicity) {
      throw 403
    }
    return (await db.banner.find()).sort((a, b) => b.startTime - a.startTime)
  },
  async post () {
    if (!this.admin.publicity) {
      throw 403
    }
    let { banner } = this.params
    await db.banner.insert(banner)
  },
  async put () {
    if (!this.admin.publicity) {
      throw 403
    }
    let { banner } = this.params
    await db.banner.update({ bid: banner.bid }, banner)
  },
  async delete () {
    if (!this.admin.publicity) {
      throw 403
    }
    let { bid } = this.params
    await db.banner.remove({ bid })
  }
}
