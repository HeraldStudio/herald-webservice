//const db = require('../../../database/publicity')
let mongodb = require('../../../database/mongodb')

exports.route = {
  async get() {
    if (!this.admin || !this.admin.publicity) {
      throw 403
    }

    let activityCollection = await mongodb('herald_activity')
    let activityClickCollection = await mongodb('herald_activity_click')

    console.log(await activityCollection.find({}).toArray())
    console.log(await activityClickCollection.find({}).toArray())

    return await Promise.all((await activityCollection.find({}, { sort: { startTime: -1 } }).toArray())
      .map(async k => {
        k.clicks = await activityClickCollection.count({ aid: k._id })
        return k
      }))
  },
  async post({ activity }) {
    let activityCollection = await mongodb('herald_activity')
    //let activityClickCollection = await mongodb('herald_activity_click')

    if (!this.admin || !this.admin.publicity) {
      throw 403
    }
    //await db.activity.insert(activity)
    await activityCollection.insertOne(activity)
    return 'OK'
  },
  async put({ activity }) {
    let activityCollection = await mongodb('herald_activity')
    //let activityClickCollection = await mongodb('herald_activity_click')

    if (!this.admin || !this.admin.publicity) {
      throw 403
    }
    //await db.activity.update({ aid: activity.aid }, activity)
    await activityCollection.updateOne({ _id: activity._id }, { $set: activity })
    return 'OK'
  },
  async delete({ _id }) {
    let activityCollection = await mongodb('herald_activity')
    let activityClickCollection = await mongodb('herald_activity_click')

    if (!this.admin || !this.admin.publicity) {
      throw 403
    }
    //await db.activity.remove({ aid })
    await activityCollection.deleteOne({ _id })
    await activityClickCollection.deleteMany({ aid: _id })
    return 'OK'
  }
}
