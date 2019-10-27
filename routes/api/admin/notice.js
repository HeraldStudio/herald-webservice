//const db = require('../../../database/publicity')
let mongodb = require('../../../database/mongodb')

exports.route = {
  async get () {
    if (!this.admin || !this.admin.maintenance) {
      throw 403
    }
    let noticeCollection = await mongodb('herald_notice')
    //return (await db.notice.find()).sort((a, b) => b.nid - a.nid)
    return (await noticeCollection.find().sort({nid:-1}).toArray())
  },
  async post ({ notice }) {
    if (!this.admin || !this.admin.maintenance) {
      throw 403
    }
    let noticeCollection = await mongodb('herald_notice')
    notice.publishTime = +moment()
    //await db.notice.insert(notice)
    await noticeCollection.insertOne(notice)
    return 'OK'
  },
  async put ({ notice }) {
    if (!this.admin || !this.admin.maintenance) {
      throw 403
    }
    let noticeCollection = await mongodb('herald_notice')
    //await db.notice.update({ nid: notice.nid }, notice)
    await noticeCollection.updateOne({nid:notice.nid}, {$set:notice})
    return 'OK'
  },
  async delete ({ nid }) {
    if (!this.admin || !this.admin.maintenance) {
      throw 403
    }
    //await db.notice.remove({ nid })
    let noticeCollection = await mongodb('herald_notice')
    await noticeCollection.deleteMany({nid})
    return 'OK'
  }
}
