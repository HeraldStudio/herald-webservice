const db = require('../../../database/publicity')
const mongodb = require('../../../database/mongodb')
exports.route = {
  async get ({ page = 1, pagesize = 10 }) {
    let bannerCollection = await mongodb('herald_banner')
    let bannerClickCollection = await mongodb('herald_banner_click')
    if (!this.admin || !this.admin.publicity) {
      throw 403
    }
    // return await Promise.all((await db.banner.find({}, pagesize, (page - 1) * pagesize, 'endTime-'))
    //   .map(async k => {
    //     k.clicks = await db.bannerClick.count({ bid: k.bid })
    //     return k
    //   }))
    return await Promise.all((await bannerCollection.find().sort('endTime', -1).skip((page - 1) * pagesize).limit(pagesize).toArray())
    .map(async k => {
      k.clicks = await bannerClickCollection.count({ bid: k.bid })
      return k
    }))
  },
  async post ({ banner }) {
    let bannerCollection = await mongodb('herald_banner')
    if (!this.admin || !this.admin.publicity) {
      throw 403
    }
    //await db.banner.insert(banner)
    await bannerCollection.insertOne(banner)
    return 'OK'
  },
  async put ({ banner }) {
    let bannerCollection = await mongodb('herald_banner')
    if (!this.admin || !this.admin.publicity) {
      throw 403
    }
    //await db.banner.update({ bid: banner.bid }, banner)
    await bannerCollection.updateOne({_id: banner.bid}, {$set:banner})
    return 'OK'
  },
  async delete ({ bid }) {
    let bannerCollection = await mongodb('herald_banner')
    let bannerClickCollection = await mongodb('herald_banner_click')
    if (!this.admin || !this.admin.publicity) {
      throw 403
    }
    //await db.banner.remove({ bid })
    //await db.bannerClick.remove({ bid })
    await bannerCollection.deleteOne({ _id:bid })
    await bannerClickCollection.deleteMany({ bid })
    return 'OK'
  }
}
