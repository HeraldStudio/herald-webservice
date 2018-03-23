const db = require('../database/publicity')

exports.route = {
  async get () {
    // 轮播图有定向推送，不能使用 public 存储，因此为了节省空间也不设缓存
    let schoolnum = this.user.isLogin ? this.user.schoolnum : ''
    let now = new Date().getTime()
    return (await db.banner.find({
      startTime: { $lte: now },
      endTime: { $gt: now }
    })).filter(k =>
      schoolnum.indexOf(k.schoolnumPrefix) === 0 ||
      !schoolnum && k.schoolnumPrefix === 'guest' ||
      schoolnum && k.schoolnumPrefix === '!guest'
    ).sort((a, b) => b.startTime - a.startTime)
  }
}
