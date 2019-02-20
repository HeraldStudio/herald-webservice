const  mongodb  = require('../../../../database/mongodb');

exports.route = {
  async get() {
    if (!this.admin || !this.admin.maintenance) {
      throw 403
    }

    let yesterday = +moment().subtract(1, 'day')
    let lastMonth = +moment().subtract(1, 'month')

    let authCollection = await mongodb('herald_auth')
    // 并行查询
    let [
      userCount, realUserCount, dailyRegister,
      dailyInvoke, monthlyRegister, monthlyInvoke, platforms
    ] = await Promise.all([
      authCollection.countDocuments({}),  // db.auth.count(),
      authCollection.distinct('cardnum'),// db.auth.count('cardnum'),
      authCollection.distinct('cardnum',{registered: { $gte: yesterday }}),// db.auth.count('cardnum', { registered: { $gte: yesterday }}),
      authCollection.distinct('cardnum',{ lastInvoked: { $gte: yesterday }}),// db.auth.count('cardnum', { lastInvoked: { $gte: yesterday }}),
      authCollection.distinct('cardnum',{ registered: { $gte: lastMonth }}),// db.auth.count('cardnum', { registered: { $gte: lastMonth }}),
      authCollection.distinct('cardnum',{ lastInvoked: { $gte: lastMonth }}),// db.auth.count('cardnum', { lastInvoked: { $gte: lastMonth }}),
      authCollection.distinct('platform')// db.auth.distinct('platform')
    ])
    
    realUserCount = realUserCount.length
    dailyRegister = dailyRegister.length
    dailyInvoke = dailyInvoke.length
    monthlyRegister = monthlyRegister.length
    monthlyInvoke = monthlyInvoke.length
    
    //用户量统计
    return {
      userCount, realUserCount, dailyRegister,
      dailyInvoke, monthlyRegister, monthlyInvoke,
      platforms: (await Promise.all(platforms.map(async platform => {
        let [
          userCount, realUserCount, dailyRegister,
          dailyInvoke, monthlyRegister, monthlyInvoke
        ] = await Promise.all([
          authCollection.countDocuments({platform}),// db.auth.count({ platform }),
          authCollection.distinct('cardnum', { platform }),
          authCollection.distinct('cardnum', { registered: { $gte: yesterday }, platform }),
          authCollection.distinct('cardnum', { lastInvoked: { $gte: yesterday }, platform }),
          authCollection.distinct('cardnum', { registered: { $gte: lastMonth }, platform }),
          authCollection.distinct('cardnum', { lastInvoked: { $gte: lastMonth }, platform })
        ])
        realUserCount = realUserCount.length
        dailyRegister = dailyRegister.length
        dailyInvoke = dailyInvoke.length
        monthlyRegister = monthlyRegister.length
        monthlyInvoke = monthlyInvoke.length
        return {
          name: platform,
          userCount, realUserCount, dailyRegister,
          dailyInvoke, monthlyRegister, monthlyInvoke
        }
      }))).sort((a, b) => b.realUserCount - a.realUserCount)
    }
  }
}
