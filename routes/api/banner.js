const db = require('../../database/publicity')

exports.route = {
  async get () {
    // 轮播图有定向推送，不能使用 public 存储，因此为了节省空间也不设缓存
    let schoolnum = this.user.isLogin ? this.user.schoolnum : ''
    let now = +moment()
    return (await db.banner.find({
      startTime: { $lte: now },
      endTime: { $gt: now }
    }, -1, 0, 'startTime-')).filter(k =>
      schoolnum.indexOf(k.schoolnumPrefix) === 0 ||
      !schoolnum && k.schoolnumPrefix === 'guest' ||
      schoolnum && k.schoolnumPrefix === '!guest'
    )
    // 这里删除 url 参数，强制要求前端在用户点击时通过 put 请求获取链接，以保证统计不遗漏
    .map(k => {
      k.hasUrl = !!k.url
      delete k.url
      return k
    })
  },

  /**
   * PUT /api/banner
   * 根据 bid 获取轮播图点击链接
   * 
   * 注：标准的前后端分离不应该有重定向 API，后端只负责提供数据，不应该控制浏览器做任何事
   * 因此这里使用 put 请求，若前端已登录，仍然需要带着 token 来请求，以便统计点击量
   */
  async put({ bid }) {
    let banner = await db.banner.find({ bid }, 1)
    if (!banner) {
      throw 404
    }

    // 对于登录用户，进行点击量统计
    if (this.user.isLogin) {
      let { identity } = this.user
      if (!await db.bannerClick.find({ bid, identity }, 1)) {
        await db.bannerClick.insert({ bid, identity })
      }
    }

    return banner.url
  }
}
