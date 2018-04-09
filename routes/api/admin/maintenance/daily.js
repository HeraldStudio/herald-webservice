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
    if (!this.admin.maintenance) {
      throw 403
    }

    let yesterday = new Date().getTime() - 1000 * 60 * 60 * 24

    // 根据需求构造更快速的数据库查询
    // 按时间片、路由、方法、状态、请求数量分组，这几项都相同的进行累计
    let dailyStat = await db.raw(`
      select
        (time - ${yesterday}) / 1800000 as period,
        route, method, status,
        round(avg(duration)) as averageDuration,
        count(*) as count
      from stat
      where time > ${yesterday} and route not like '/api/admin/%'
      group by period, route, method, status;
    `)
    let totalCount = dailyStat.length
    dailyStat = dailyStat.map(k => {
      k.operation = k.method + ' ' + k.route
      return k
    })

    // 不直接拿数据库结果做 map，防止遗漏没有请求的时间片
    // 首先得到 [0, 48) 的整数区间，对其使用 map
    return [].slice.call([].fill.call({ length: 24 * 2 }, 0)).map((_, i) => {

      // 对于 [0, 48) 的每一个整数，在日志中查找该时间范围内的请求
      let operations = dailyStat.filter(k => k.period === i).groupBy('operation', 'results').map(group => {

        // 经过 groupBy 分组操作后，每一组都包含 operation 字符串和对应的 results 数组
        // 这里每一个 group 代表同一个时间段内的每一种不同操作
        // 对于每个操作，这里需要转化为概括该操作所有不同结果的一个对象
        return {

          // 操作名称保留不变
          operation: group.operation,

          // 操作结果再按 status 状态码分组
          results: group.results.map(k => ({
            status: k.status,
            count: k.count,
            averageDuration: k.averageDuration
          })),

          // 执行该操作的请求的总次数
          count: group.results.map(k => k.count).reduce((a, b) => a + b, 0)
        }
      })

      // 返回能够概括该时间范围内所有类型请求情况的一个对象
      return {

        // 时间范围的开始和结束戳
        startTime: i * (1000 * 60 * 30) + yesterday,
        endTime: (i + 1) * (1000 * 60 * 30) + yesterday,

        // 该时间范围内的所有请求的数组，按不同操作进行分组
        operations,

        // 该时间范围内的请求的总次数
        count: operations.map(k => k.count).reduce((a, b) => a + b, 0)
      }
    })
  }
}
