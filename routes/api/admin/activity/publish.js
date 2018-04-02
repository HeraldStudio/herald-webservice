const db = require('../../../../database/publicity')
const admindb = require('../../../../database/admin')

exports.route = {
  async get () {
    if (!this.admin.publisher) {
      throw 403
    }
    let { cardnum } = this.user
    let { page = 1, pagesize = 10 } = this.params
    return (await db.activity.find({ committedBy: cardnum }))
      .sort((a, b) => b.startTime - a.startTime)
      .slice((page - 1) * pagesize, page * pagesize)
  },
  async post () {
    if (!this.admin.publisher) {
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
    if (!this.admin.publisher) {
      throw 403
    }
    let { activity } = this.params
    let { cardnum } = this.user
    activity.committedBy = cardnum
    activity.admittedBy = ''
    await db.activity.update({ aid: activity.aid, committedBy: cardnum }, activity)
    return 'OK'
  },
  async delete () {
    if (!this.admin.publisher) {
      throw 403
    }
    let { aid } = this.params
    let { cardnum } = this.user
    await db.activity.remove({ aid, committedBy: cardnum })
    return 'OK'
  }
}
