const db = require('../../../../database/auth')

exports.route = {
  async get() {
    if (!this.admin || !this.admin.maintenance) {
      throw 403
    }

    let yesterday = +moment().subtract(1, 'day')
    let lastMonth = +moment().subtract(1, 'month')

    // 并行查询
    let [
      userCount, realUserCount, dailyRegister,
      dailyInvoke, monthlyRegister, monthlyInvoke, platforms
    ] = await Promise.all([
      db.auth.count(),
      db.auth.count('cardnum'),
      db.auth.count('cardnum', { registered: { $gte: yesterday }}),
      db.auth.count('cardnum', { lastInvoked: { $gte: yesterday }}),
      db.auth.count('cardnum', { registered: { $gte: lastMonth }}),
      db.auth.count('cardnum', { lastInvoked: { $gte: lastMonth }}),
      db.auth.distinct('platform')
    ])

    // 用户量统计
    return {
      userCount, realUserCount, dailyRegister,
      dailyInvoke, monthlyRegister, monthlyInvoke,
      platforms: (await Promise.all(platforms.map(async platform => {
        let [
          userCount, realUserCount, dailyRegister,
          dailyInvoke, monthlyRegister, monthlyInvoke
        ] = await Promise.all([
          db.auth.count({ platform }),
          db.auth.count('cardnum', { platform }),
          db.auth.count('cardnum', { registered: { $gte: yesterday }, platform }),
          db.auth.count('cardnum', { lastInvoked: { $gte: yesterday }, platform }),
          db.auth.count('cardnum', { registered: { $gte: lastMonth }, platform }),
          db.auth.count('cardnum', { lastInvoked: { $gte: lastMonth }, platform })
        ])
        return {
          name: platform,
          userCount, realUserCount, dailyRegister,
          dailyInvoke, monthlyRegister, monthlyInvoke
        }
      }))).sort((a, b) => b.realUserCount - a.realUserCount)
    }
  }
}
