const db = require('../../database/publicity')
const mongodb = require('../../database/mongodb')
exports.route = {
  async get ({ page = 1, pagesize = 10 }) {
    let activityCollection = await mongodb('herald_activity')
    return await this.publicCache('1m', async () => {
      //return (await db.activity.find({}, pagesize, (page - 1) * pagesize, 'endTime-'))
      return (await activityCollection.find().limit(pagesize).skip((page - 1)*pagesize).toArray())
        // 这里删除 url 参数，强制要求前端在用户点击时通过 put 请求获取链接，以保证统计不遗漏
        .map(k => {
          k.hasUrl = !!k.url
          delete k.url
          return k
        })
    })
  },

  /**
   * PUT /api/activity
   * 根据 aid 获取活动点击链接
   * 
   * 注：标准的前后端分离不应该有重定向 API，后端只负责提供数据，不应该控制浏览器做任何事
   * 因此这里使用 put 请求，若前端已登录，仍然需要带着 token 来请求，以便统计点击量
   */
  async put ({ aid }) {
    let activityCollection = await mongodb('herald_activity')
    let activityClickCollection = await mongodb('herald_activity_click')
    //let activity = await db.activity.find({ aid }, 1)
    let activity = await activityCollection.findOne({aid})
    if (!activity) {
      throw 404
    }

    // 对于登录用户，进行点击量统计
    if (this.user.isLogin) {
      let { identity } = this.user
      // if (!await db.activityClick.find({ aid, identity }, 1)) {
      //   await db.activityClick.insert({ aid, identity })
      // }
      if((await activityClickCollection.countDocuments({aid, identity})) === 0){
        await activityClickCollection.insertOne({ aid, identity })
      }
    }

    return activity.url
  }
}
