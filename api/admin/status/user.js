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
      db.auth.count('cardnum'),
      db.auth.count('cardnum', { registered: { $gte: yesterday }}),
      db.auth.count('cardnum', { last_invoked: { $gte: yesterday }}),
      db.auth.count('cardnum', { registered: { $gte: lastMonth }}),
      db.auth.count('cardnum', { last_invoked: { $gte: lastMonth }}),
      db.auth.distinct('platform')
    ])

    // 用户量统计
    return {
      userCount, realUserCount, dailyRegister,
      dailyInvoke, monthlyRegister, monthlyInvoke,
      platforms: (await Promise.all(platforms.map(platform => (async () => {
        let [
          userCount, realUserCount, dailyRegister,
          dailyInvoke, monthlyRegister, monthlyInvoke
        ] = await Promise.all([
          db.auth.count({ platform }),
          db.auth.count('cardnum', { platform }),
          db.auth.count('cardnum', { registered: { $gte: yesterday }, platform }),
          db.auth.count('cardnum', { last_invoked: { $gte: yesterday }, platform }),
          db.auth.count('cardnum', { registered: { $gte: lastMonth }, platform }),
          db.auth.count('cardnum', { last_invoked: { $gte: lastMonth }, platform })
        ])
        return {
          name: platform,
          userCount, realUserCount, dailyRegister,
          dailyInvoke, monthlyRegister, monthlyInvoke
        }
      })()))).sort((a, b) => b.userCount - a.userCount)
    }
  }
}
