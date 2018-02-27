const db = require('../../database/publicity')
const admindb = require('../../database/admin')

exports.route = {
  async get () {
    // 发布者获取所有自己发布的活动
    // 管理员获取所有活动
    if (this.admin.publisher) {
      let { cardnum } = this.user
      let { page = 1, pagesize = 10 } = this.params
      return await Promise.all((await db.activity.find({ committedBy: cardnum }))
        .sort((a, b) => b.startTime - a.startTime)
        .slice((page - 1) * pagesize, page * pagesize)
        .map(async k => {
          k.committedByName = (await admindb.admin.find({ cardnum: k.committedBy }, 1)).name
          if (k.admittedBy) {
            k.admittedByName = (await admindb.admin.find({ cardnum: k.admittedBy }, 1)).name
          }
          return k
        }))
    } else if (this.admin.publicity) {
      let { page = 1, pagesize = 10 } = this.params
      return (await db.activity.find())
        .sort((a, b) => b.startTime - a.startTime)
        .slice((page - 1) * pagesize, page * pagesize)
    }
    throw 403
  },
  async post () {
    // 发布者和管理员都可以发布活动，发布时默认都是未审核状态
    if (this.admin.publisher || this.admin.publicity) {
      let { cardnum } = this.user
      let { activity } = this.params
      activity.committedBy = cardnum
      activity.admittedBy = ''
      await db.activity.insert(activity)
      return
    }
    throw 403
  },
  async put () {
    // 发布者修改活动，只能修改自己发布的活动，无论活动是否已审核，一律变为未审核状态
    // 管理员通过此接口修改活动，保存后活动将自动通过审核
    if (this.admin.publisher) {
      let { activity } = this.params
      let { cardnum } = this.user
      activity.committedBy = cardnum
      activity.admittedBy = ''
      await db.activity.update({ aid: activity.aid, committedBy: cardnum }, activity)
    } else if (this.admin.publicity) {
      let { activity } = this.params
      let { cardnum } = this.user
      activity.admittedBy = cardnum
      await db.activity.update({ aid: activity.aid }, activity)
    }
    throw 403
  },
  async delete () {
    // 发布者和管理员均可删除活动，其中发布者只能删除自己发布的活动
    if (this.admin.publisher || this.admin.publicity) {
      let { aid } = this.params
      let { cardnum } = this.user
      if (this.admin.publisher) {
        await db.activity.remove({ aid, committedBy: cardnum })
      } else {
        await db.activity.remove({ aid })
      }
    }
    throw 403
  }
}
