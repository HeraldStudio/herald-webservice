const db = require('../../../database/publicity')

exports.route = {
  async get ({ page = 1, pagesize = 10 }) {
    if (!this.admin || !this.admin.publicity) {
      throw 403
    }
    return await Promise.all((await db.activity.find({}, pagesize, (page - 1) * pagesize, 'startTime-'))
      .map(async k => {
        k.clicks = await db.activityClick.count({ aid: k.aid })
        return k
      }))
  },
  async post ({ activity }) {
    if (!this.admin || !this.admin.publicity) {
      throw 403
    }
    await db.activity.insert(activity)
    return 'OK'
  },
  async put ({ activity }) {
    if (!this.admin || !this.admin.publicity) {
      throw 403
    }
    await db.activity.update({ aid: activity.aid }, activity)
    return 'OK'
  },
  async delete ({ aid }) {
    if (!this.admin || !this.admin.publicity) {
      throw 403
    }
    await db.activity.remove({ aid })
    await db.activityClick.remove({ aid })
    return 'OK'
  }
}
