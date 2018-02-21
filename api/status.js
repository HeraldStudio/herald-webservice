const { db } = require('../middleware/statistics')
const authdb = require('../middleware/auth').db

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

exports.route = {
  async get () {
    if (!this.admin.maintenance) {
      throw 403
    }

    const testConnection = async (url) => {
      let start = new Date().getTime()
      try { await this.get(url, { timeout: 1000 }) } catch (e) { return -1 }
      let end = new Date().getTime()
      return end - start
    }

    // 上游测试
    const tests = {
      '教务处前台': 'http://jwc.seu.edu.cn',
      '教务处教务系统': 'http://xk.urp.seu.edu.cn/studentService/system/showLogin.action',
      '教务处课表查询': 'http://xk.urp.seu.edu.cn/jw_service/service/lookCurriculum.action',
      '教务处验证码': 'https://boss.myseu.cn/jwccaptcha/',
      '老信息门户': 'http://myold.seu.edu.cn',
      '新信息门户': 'http://my.seu.edu.cn',
      '图书馆': 'http://www.libopac.seu.edu.cn:8080/reader/login.php',
      '图书馆验证码': 'https://boss.myseu.cn/libcaptcha/',
      '空教室&开学日期': 'http://58.192.114.179/classroom/common/gettermlistex',
      '一卡通中心': 'http://allinonecard.seu.edu.cn/ecard/dongnanportalHome.action',
      '体育系跑操查询': 'http://zccx.seu.edu.cn',
      '物理实验中心': 'http://phylab.seu.edu.cn/plms/UserLogin.aspx',
      '场馆预约': 'http://yuyue.seu.edu.cn/eduplus/phoneOrder/initOrderIndexP.do',
      'SRTP': 'http://10.1.30.98:8080/srtp2/USerPages/SRTP/Report3.aspx',
      '网络中心': 'https://selfservice.seu.edu.cn/selfservice/campus_login.php'
    }

    // 上游测试结果
    const upstream = await Promise.all(Object.keys(tests).map(k => (async () => {
      let name = k, url = tests[k]
      let timeout = await testConnection(tests[k])
      let health = timeout >= 0 && timeout < 1000
      return { name, url, timeout, health }
    })()))

    // 24 小时接口调用统计
    let yesterday = new Date().getTime() - 1000 * 60 * 60 * 24
    let dailyStat = await db.stat.find({ time: { $gte: yesterday } })
    let totalCount = dailyStat.length
    dailyStat = dailyStat.map(k => {
      k.operation = k.method + ' ' + k.route
      k.period = Math.floor((k.time - yesterday) / (1000 * 60 * 30))
      return k
    })

    // 得到 [0, 48) 的整数区间，对其使用 map
    let periods = [].slice.call([].fill.call({ length: 24 * 2 }, 0)).map((_, i) => {

      // 对于 [0, 48) 的每一个整数，在日志中查找该时间范围内的请求
      let operations = dailyStat.filter(k => k.period === i)

      // 返回能够概括该时间范围内所有请求情况的一个对象
      return {

        // 时间范围的开始和结束戳
        startTime: i * (1000 * 60 * 30) + yesterday,
        endTime: (i + 1) * (1000 * 60 * 30) + yesterday,

        // 该时间范围内的所有请求的数组，按不同操作进行分组
        operations: operations.groupBy('operation', 'results').map(group => {

          // 经过 groupBy 分组操作后，每一组都包含 operation 字符串和对应的 results 数组
          // 这里每一个 group 代表同一个时间段内的每一种不同操作
          // 对于每个操作，这里需要转化为概括该操作所有不同结果的一个对象
          return {

            // 操作名称保留不变
            operation: group.operation,

            // 操作结果再按 status 状态码分组
            results: group.results.groupBy('status', 'requests').map(group => {

              // 经过 groupBy 分组操作后，每一组都包含 status 整数和对应的 requests 数组
              // 这里每一个 group 代表同一个操作的每一种不同结果
              // 对于每个结果，这里需要转化为概括该请求结果的出现次数、平均用时等详细情况的一个对象
              return {

                // 状态码保留不变
                status: group.status,

                // 得到该结果的请求的平均耗时
                averageDuration: group.requests.length ? Math.round(
                  group.requests
                    .map(request => request.duration)
                    .reduce((a, b) => a + b, 0) / group.requests.length
                  ) : 0,

                // 得到该结果的请求出现的次数
                count: group.requests.length
              }
            }),

            // 执行该操作的请求的总次数
            count: group.results.length
          }
        }),

        // 该时间范围内的请求的总次数
        count: operations.length
      }
    })

    // 并行查询
    let lastMonth = new Date().getTime() - 1000 * 60 * 60 * 24 * 30
    let [
      userCount, realUserCount, dailyRegister,
      dailyInvoke, monthlyRegister, monthlyInvoke, platforms
    ] = await Promise.all([
      authdb.auth.count(),
      authdb.auth.distinct('cardnum').then(k => k.length),
      authdb.auth.count({ registered: { $gte: yesterday }}),
      authdb.auth.count({ last_invoked: { $gte: yesterday }}),
      authdb.auth.count({ registered: { $gte: lastMonth }}),
      authdb.auth.count({ last_invoked: { $gte: lastMonth }}),
      authdb.auth.distinct('platform')
    ])

    // 用户量统计
    let users = {
      userCount, realUserCount, dailyRegister,
      dailyInvoke, monthlyRegister, monthlyInvoke,
      platforms: await Promise.all(platforms.map(platform => (async () => {
        let [
          userCount, realUserCount, dailyRegister,
          dailyInvoke, monthlyRegister, monthlyInvoke
        ] = await Promise.all([
          authdb.auth.count({ platform }),
          authdb.auth.distinct('cardnum', { platform }).then(k => k.length),
          authdb.auth.count({ registered: { $gte: yesterday }, platform }),
          authdb.auth.count({ last_invoked: { $gte: yesterday }, platform }),
          authdb.auth.count({ registered: { $gte: lastMonth }, platform }),
          authdb.auth.count({ last_invoked: { $gte: lastMonth }, platform })
        ])
        return {
          name: platform,
          userCount, realUserCount, dailyRegister,
          dailyInvoke, monthlyRegister, monthlyInvoke
        }
      })()))
    }
    return { upstream, users, periods }
  }
}
