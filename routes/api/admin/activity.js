//const db = require('../../../database/publicity')
let mongodb = require('../../../database/mongodb')

exports.route = {
  async get ({ page = 1, pagesize = 10 }) {
    if (!this.admin || !this.admin.publicity) {
      throw 403
    }
    
    let activityCollection = await mongodb('herald_activity')
    let activityClickCollection = await mongodb('herald_activity_click')

    return await Promise.all((await activityCollection.find({},{sort:{startTime:-1}}).toArray())
      .map(async k => {
        k.clicks = await activityClickCollection.count({ aid: k.aid })
        return k
      }))
  },
  async post ({ activity }) {
    let activityCollection = await mongodb('herald_activity')
    let activityClickCollection = await mongodb('herald_activity_click')

    if (!this.admin || !this.admin.publicity) {
      throw 403
    }
    //await db.activity.insert(activity)
    await activityCollection.insertOne(activity)
    return 'OK'
  },
  async put ({ activity }) {
    let activityCollection = await mongodb('herald_activity')
    let activityClickCollection = await mongodb('herald_activity_click')

    if (!this.admin || !this.admin.publicity) {
      throw 403
    }
    //await db.activity.update({ aid: activity.aid }, activity)
    await activityCollection.updateOne({ aid: activity.aid },{$set:activity})
    return 'OK'
  },
  async delete ({ aid }) {
    let activityCollection = await mongodb('herald_activity')
    let activityClickCollection = await mongodb('herald_activity_click')

    if (!this.admin || !this.admin.publicity) {
      throw 403
    }
    //await db.activity.remove({ aid })
    await activityCollection.deleteOne({ aid })
    await activityClickCollection.deleteOne({ aid })
    return 'OK'
  }
}
