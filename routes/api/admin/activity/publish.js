const db = require('../../../../database/publicity')
const admindb = require('../../../../database/admin')

exports.route = {
  async get ({ page = 1, pagesize = 10 }) {
    if (!this.admin.publisher) {
      throw 403
    }
    let { cardnum } = this.user
    return (await db.activity.find({ committedBy: cardnum }))
      .sort((a, b) => b.startTime - a.startTime)
      .slice((page - 1) * pagesize, page * pagesize)
  },
  async post ({ activity }) {
    if (!this.admin.publisher) {
      throw 403
    }
    let { cardnum } = this.user
    activity.committedBy = cardnum
    activity.admittedBy = ''
    await db.activity.insert(activity)
    return 'OK'
  },
  async put ({ activity }) {
    if (!this.admin.publisher) {
      throw 403
    }
    let { cardnum } = this.user
    activity.committedBy = cardnum
    activity.admittedBy = ''
    await db.activity.update({ aid: activity.aid, committedBy: cardnum }, activity)
    return 'OK'
  },
  async delete ({ aid }) {
    if (!this.admin.publisher) {
      throw 403
    }
    let { cardnum } = this.user
    await db.activity.remove({ aid, committedBy: cardnum })
    return 'OK'
  }
}
