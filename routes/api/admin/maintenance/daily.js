const db = require('../../../../database/stat')

Array.prototype.groupBy = function(keyOfKey, keyOfValue) {
  let keys = this.map(k => k[keyOfKey]).sort()
  let result = {}
  for (let k of keys) {
    if (!result[k]) {
      result[k] = this.filter(j => j[keyOfKey] === k).map(j => {
        delete j[keyOfKey]
        return j
      })
    }
  }
  return Object.keys(result).map(k => {
    return {
      [keyOfKey]: k,
      [keyOfValue]: result[k]
    }
  })
}

// 24 小时接口调用统计
exports.route = {
  async get() {
    if (!this.admin || !this.admin.maintenance) {
      throw 403
    }

    let now = +moment()
    let today = +moment().startOf('day')
    let yesterdayNow = +moment().subtract(1, 'day')
    let yesterday = +moment().subtract(1, 'day').startOf('day')

    // 根据需求构造更快速的数据库查询
    // 按时间片、路由、方法、状态、请求数量分组，这几项都相同的进行累计
    // 这里不能直接用 time 做条件，会导致遍历所有日志，导致发生拥塞
    // 而是需要利用 time 的递增性，先查询最后一条昨天的日志，然后取所有这条日志之后的所有记录
    let dailyStat = await db`
      select
        cast(((time - ${yesterday}) % 86400000 / 1800000) as int) as period,
        route, status,
        count(*) as count
      from stat
      where rowid > (
        select rowid from stat where time < ${yesterdayNow} order by rowid desc limit 1
      ) and route not like '/api/admin/%'
      group by period, route, status;
    `
    let totalCount = dailyStat.length
    let userStat = await db`
      select
        cast(((time - ${yesterday}) % 86400000 / 1800000) as int) as period,
        count(distinct(identity)) as userCount
      from stat
      where rowid > (
        select rowid from stat where time < ${yesterdayNow} order by rowid desc limit 1
      ) and route not like '/api/admin/%'
      group by period;
    `

    // 不直接拿数据库结果做 map，防止遗漏没有请求的时间片
    // 首先得到 [0, 48) 的整数区间，对其使用 map
    return Array(24 * 2).fill().map((_, i) => {

      // 对于 [0, 48) 的每一个整数，在日志中查找该时间范围内的请求
      let routes = dailyStat.filter(k => k.period === i).groupBy('route', 'results').map(group => {

        // 经过 groupBy 分组操作后，每一组都包含路由名和对应的 results 数组
        // 这里每一个 group 代表同一个时间段内的每一种不同操作
        // 对于每个操作，这里需要转化为概括该操作所有不同结果的一个对象
        return {

          // 路由名保留不变
          route: group.route,

          // 操作结果再按 status 状态码分组
          results: group.results.map(k => ({
            status: k.status,
            count: k.count
          })),

          // 执行该操作的请求的总次数
          count: group.results.map(k => k.count).reduce((a, b) => a + b, 0)
        }
      })

      let isToday = now - today >= i * 1800000

      // 返回能够概括该时间范围内所有类型请求情况的一个对象
      return {
        isToday,

        userCount: (userStat.find(k => k.period === i) || {}).userCount || 0,

        // 该时间范围内的所有请求的数组，按不同操作进行分组
        routes,

        // 该时间范围内的请求的总次数
        count: routes.map(k => k.count).reduce((a, b) => a + b, 0)
      }
    })
  }
}
