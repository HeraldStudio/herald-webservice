const mongodb = require('../../database/mongodb')
const moment = require('moment')

exports.route = {
  async get () {
    let bannerCollection = await mongodb('herald_banner')
    // 轮播图有定向推送，不能使用 public 存储，因此为了节省空间也不设缓存
    let schoolnum = this.user.isLogin ? this.user.schoolnum : ''
    let now = +moment()
    return (
    //   await db.banner.find({
    //   startTime: { $lte: now },
    //   endTime: { $gt: now }
    // }, -1, 0, 'startTime-'))
      (await bannerCollection.find({
        startTime: { $lte: now },
        endTime: { $gt: now }
      }).sort('startTime', -1).toArray())
        .filter(k =>
          schoolnum.indexOf(k.schoolnumPrefix) === 0 ||
      !schoolnum && k.schoolnumPrefix === 'guest' ||
      schoolnum && k.schoolnumPrefix === '!guest'
        )
      // 这里删除 url 参数，强制要求前端在用户点击时通过 put 请求获取链接，以保证统计不遗漏
      // 将bid替换成_id
        .map(k => {
          k.hasUrl = !!k.url
          delete k.url
          return k
        }))
  },

  /**
   * PUT /api/banner
   * 根据 id 获取轮播图点击链接
   * 
   * 注：标准的前后端分离不应该有重定向 API，后端只负责提供数据，不应该控制浏览器做任何事
   * 因此这里使用 put 请求，若前端已登录，仍然需要带着 token 来请求，以便统计点击量
   */
  async put({ id }) {
    let now = moment()
    if (!this.user.isLogin) {
      // 强制一下，必须在登录态才能获取链接
      throw 403
    }
    if (!id) {
      throw '未指定轮播图id'
    }
    let banner = await this.db.execute(
      `SELECT TITLE, URL from TOMMY.H_BANNER WHERE ID = :id`,
      {
        id
      }
    )
    
    if (banner.rows.length === 0){
      throw 404
    }
    // 成功获取链接，插入一条点击链接的记录
    await this.db.execute(
      `INSERT INTO TOMMY.H_BANNER_CLICK
      (CARDNUM, BID, CREATED_TIME )
      VALUES (:cardnum, :bid, :creatTime)
      `,
      {
        cardnum: this.user.cardnum,
        bid: id,
        creatTime: now.toDate()
      })
    return banner.rows[0][1] ? banner.rows[0][1] : 'javascript:void(0)'
  }
}
