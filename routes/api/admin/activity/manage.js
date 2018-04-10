const db = require('../../../../database/publicity')
const admindb = require('../../../../database/admin')

exports.route = {
  async get ({ page = 1, pagesize = 10 }) {
    if (!this.admin || !this.admin.publicity) {
      throw 403
    }
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
  async post ({ activity }) {
    if (!this.admin || !this.admin.publicity) {
      throw 403
    }
    let { cardnum } = this.user
    activity.committedBy = cardnum
    activity.admittedBy = ''
    await db.activity.insert(activity)
    return 'OK'
  },
  async put ({ activity }) {
    if (!this.admin || !this.admin.publicity) {
      throw 403
    }
    let { cardnum } = this.user
    activity.admittedBy = cardnum
    await db.activity.update({ aid: activity.aid }, activity)
    return 'OK'
  },
  async delete ({ aid }) {
    if (!this.admin || !this.admin.publicity) {
      throw 403
    }
    let { cardnum } = this.user
    await db.activity.remove({ aid })
    return 'OK'
  }
}
