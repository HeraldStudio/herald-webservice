const db = require('../../../../database/publicity')
const admindb = require('../../../../database/admin')

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
        let record = await admindb.admin.find({ cardnum: k.committedBy }, 1)
        k.committedByName = record ? record.name : k.committedBy
        if (k.admittedBy) {
          record = await admindb.admin.find({ cardnum: k.admittedBy }, 1)
          k.admittedByName = record ? record.name : k.admittedBy
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
    return 'OK'
  },
  async put () {
    if (!this.admin.publicity) {
      throw 403
    }
    let { activity } = this.params
    let { cardnum } = this.user
    activity.admittedBy = cardnum
    await db.activity.update({ aid: activity.aid }, activity)
    return 'OK'
  },
  async delete () {
    if (!this.admin.publicity) {
      throw 403
    }
    let { aid } = this.params
    let { cardnum } = this.user
    await db.activity.remove({ aid })
    return 'OK'
  }
}
