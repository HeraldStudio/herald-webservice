const db = require('../../../database/auth')

exports.route = {
  async get() {
    if (!this.admin.maintenance) {
      throw 403
    }

    let yesterday = new Date().getTime() - 1000 * 60 * 60 * 24
    let lastMonth = new Date().getTime() - 1000 * 60 * 60 * 24 * 30

    // 并行查询
    let [
      userCount, realUserCount, dailyRegister,
      dailyInvoke, monthlyRegister, monthlyInvoke, platforms
    ] = await Promise.all([
      db.auth.count(),
      db.auth.distinct('cardnum').then(k => k.length),
      db.auth.count({ registered: { $gte: yesterday }}),
      db.auth.count({ last_invoked: { $gte: yesterday }}),
      db.auth.count({ registered: { $gte: lastMonth }}),
      db.auth.count({ last_invoked: { $gte: lastMonth }}),
      db.auth.distinct('platform')
    ])

    // 用户量统计
    return {
      userCount, realUserCount, dailyRegister,
      dailyInvoke, monthlyRegister, monthlyInvoke,
      platforms: await Promise.all(platforms.map(platform => (async () => {
        let [
          userCount, realUserCount, dailyRegister,
          dailyInvoke, monthlyRegister, monthlyInvoke
        ] = await Promise.all([
          db.auth.count({ platform }),
          db.auth.distinct('cardnum', { platform }).then(k => k.length),
          db.auth.count({ registered: { $gte: yesterday }, platform }),
          db.auth.count({ last_invoked: { $gte: yesterday }, platform }),
          db.auth.count({ registered: { $gte: lastMonth }, platform }),
          db.auth.count({ last_invoked: { $gte: lastMonth }, platform })
        ])
        return {
          name: platform,
          userCount, realUserCount, dailyRegister,
          dailyInvoke, monthlyRegister, monthlyInvoke
        }
      })()))
    }
  }
}
