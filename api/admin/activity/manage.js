const db = require('../../../database/publicity')
const admindb = require('../../../database/admin')

exports.route = {
  async get () {
    if (!this.admin.publicity) {
      throw 403
    }
    let { page = 1, pagesize = 10 } = this.params
    return await Promise.all((await db.activity.find())
      .sort((a, b) => !a.admittedBy ? -1 : (!b.admittedBy ? 1 : b.startTime - a.startTime))
      .slice((page - 1) * pagesize, page * pagesize)
      .map(async k => {
        k.committedByName = (await admindb.admin.find({ cardnum: k.committedBy }, 1)).name
        if (k.admittedBy) {
          k.admittedByName = (await admindb.admin.find({ cardnum: k.admittedBy }, 1)).name
        }
        return k
      }))
  },
  async post () {
    if (!this.admin.publicity) {
      throw 403
    }
    let { cardnum } = this.user
    let { activity } = this.params
    activity.committedBy = cardnum
    activity.admittedBy = ''
    await db.activity.insert(activity)
    return
  },
  async put () {
    if (!this.admin.publicity) {
      throw 403
    }
    let { activity } = this.params
    let { cardnum } = this.user
    activity.admittedBy = cardnum
    await db.activity.update({ aid: activity.aid }, activity)
  },
  async delete () {
    if (!this.admin.publicity) {
      throw 403
    }
    let { aid } = this.params
    let { cardnum } = this.user
    await db.activity.remove({ aid })
  }
}
