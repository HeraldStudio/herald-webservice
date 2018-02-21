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

    // 24小时接口调用统计
    let yesterday = new Date().getTime() - 1000 * 60 * 60 * 24
    let dailyStat = await db.stat.find({ time: { $gte: yesterday } })
    let totalCount = dailyStat.length
    dailyStat = dailyStat.map(k => {
      k.operation = k.method + ' ' + k.route
      k.period = Math.floor((k.time - yesterday) / (1000 * 60 * 30))
      return k
    }).groupBy('operation', 'periods').map(operation => {
      operation.count = operation.periods.length
      operation.ratio = operation.count / totalCount
      operation.periods = operation.periods.groupBy('period', 'results').map(period => {
        period.period = {
          startTime: period.period * (1000 * 60 * 30) + yesterday,
          endTime: (period.period + 1) * (1000 * 60 * 30) + yesterday
        }
        period.count = period.results.length
        period.ratio = period.count / operation.count
        period.results = period.results.groupBy('status', 'requests').map(status => {
          status.count = status.requests.length
          status.ratio = status.count / period.count
          status.averageDuration = status.requests.length
            ? Math.round(status.requests
                .map(request => request.duration)
                .reduce((a, b) => a + b, 0) / status.count)
            : 0
          delete status.requests
          return status
        })
        return period
      })
      return operation
    })

    let lastMonth = new Date().getTime() - 1000 * 60 * 60 * 24 * 30

    // 用户量统计
    let users = {
      totalCount: await authdb.auth.count(),
      realUserCount: (await authdb.auth.distinct('cardnum')).length,
      dailyRegister: await authdb.auth.count({ registered: { $gte: yesterday }}),
      dailyInvoke: await authdb.auth.count({ last_invoked: { $gte: yesterday }}),
      monthlyRegister: await authdb.auth.count({ registered: { $gte: lastMonth }}),
      monthlyInvoke: await authdb.auth.count({ last_invoked: { $gte: lastMonth }}),
      platforms: await Promise.all(
        (await authdb.auth.distinct('platform'))
          .map(platform => (async () => {
            return {
              name: platform,
              count: await authdb.auth.count({ platform }),
              realUserCount: (await authdb.auth.distinct('cardnum', { platform })).length,
              dailyRegister: await authdb.auth.count({ registered: { $gte: yesterday }, platform }),
              dailyInvoke: await authdb.auth.count({ last_invoked: { $gte: yesterday }, platform }),
              monthlyRegister: await authdb.auth.count({ registered: { $gte: lastMonth }, platform }),
              monthlyInvoke: await authdb.auth.count({ last_invoked: { $gte: lastMonth }, platform })
            }
          })())
      )
    }
    return { upstream, users, dailyStat }
  }
}
