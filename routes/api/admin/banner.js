const db = require('../../../database/publicity')

exports.route = {
  async get ({ page = 1, pagesize = 10 }) {
    if (!this.admin || !this.admin.publicity) {
      throw 403
    }
    return await Promise.all((await db.banner.find({}, pagesize, (page - 1) * pagesize, 'endTime-'))
      .map(async k => {
        k.clicks = await db.bannerClick.count({ bid: k.bid })
        return k
      }))
  },
  async post ({ banner }) {
    if (!this.admin || !this.admin.publicity) {
      throw 403
    }
    await db.banner.insert(banner)
    return 'OK'
  },
  async put ({ banner }) {
    if (!this.admin || !this.admin.publicity) {
      throw 403
    }
    await db.banner.update({ bid: banner.bid }, banner)
    return 'OK'
  },
  async delete ({ bid }) {
    if (!this.admin || !this.admin.publicity) {
      throw 403
    }
    await db.banner.remove({ bid })
    await db.bannerClick.remove({ bid })
    return 'OK'
  }
}
