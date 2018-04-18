/**
 * wx-herald 小猴偷米微信公众号中间件
 */
const chalk = require('chalk')
const wechat = require('co-wechat')
const config = require('../../sdk/sdk.json').wechat['wx-herald']
const api = require('../../sdk/wechat').getAxios('wx-herald')
const df = require('./date-format')

String.prototype.padd = function () {
  return this.split('\n').map(k => k.trim()).join('\n')
}

// 生产环境更新自定义菜单
if (process.env.NODE_ENV === 'production') {
  const menu = require('./wx-herald-menu.json')
  api.post('/menu/create', menu).then(res => {
    console.log(chalk.blue('[wx-herald] 自定义菜单 ') + res.data.errmsg)
  })
}

// 各种功能的 handler 函数或对象
const handler = {
  '菜单': `🐵 小猴偷米功能菜单

          💬 一卡通 课表 跑操 体测
          💬 　实验 考试 成绩 讲座
          💬 　图书 奖助 搜索 SRTP

          回复关键词使用对应功能`.padd(),

  async '绑定' (cardnum, password, gpassword = '') {
    this.path = '/auth'
    this.method = 'POST'
    this.params = {
      cardnum, password, gpassword,
      customToken: this.message.FromUserName,
      platform: 'wx-herald'
    }
    await this.next()
    return `🔗 绑定成功，回复 菜单 查看功能列表~
    💡 若之前绑定过其他账号，旧账号缓存数据会出现短时间的暂留，属正常现象。`.padd()
  },

  async '一卡通' (date) {
    this.path = '/api/card'
    this.method = 'GET'
    this.query = this.params = { date }
    await this.next()
    let { info, detail } = this.body
    let total = (- detail.map(k => k.amount).filter(k => k < 0).reduce((a, b) => a + b, 0)).toFixed(2)
    return [
      `💳 一卡通余额 ${info.balance}`,
      `${date || '今日'} 总支出 ${ total } 元`,
      detail.map(k => {
        let time = df.formatTimeNatural(k.time)
        let amount = k.amount.toFixed(2).replace(/^(?:\d)/, '+')
        return date ? `${k.desc} ${amount}` : `${time}：${k.desc} ${amount}`
      }).join('\n'),
      date ? '' : `💡 可查指定日期，注意日期前加空格，例如：一卡通 2018-3-17`
    ].filter(k => k).join('\n\n').padd()
  },

  async '课表' () {
    this.path = '/api/curriculum'
    this.method = 'GET'
    await this.next()

    let { curriculum } = this.body
    curriculum = curriculum.map(course => {
      let { courseName, location, events = [] } = course
      return events.map(e => Object.assign(e, { courseName, location }))
    }).reduce((a, b) => a.concat(b), [])

    let now = new Date().getTime()
    let endedCount = curriculum.filter(k => k.endTime <= now).length
    let upcoming = curriculum.filter(k => k.startTime > now).sort((a, b) => a.startTime - b.startTime)
    let upcomingCount = upcoming.length
    let current = curriculum.filter(k => k.startTime <= now && k.endTime > now)
    let currentCount = current.length

    return [
      `🗓 已上 ${endedCount} 次课，还有 ${upcomingCount} 次课`, 
      current.map(k => `正在上课：${k.courseName} @ ${k.location}\n`).join(''),
      upcoming.slice(0, 5).map(k => `${df.formatPeriodNatural(k.startTime, k.endTime)}
        ${k.courseName} @ ${k.location}`).join('\n\n'),
      `💡 完整课表详见网页版或小程序`
    ].filter(k => k).join('\n\n').padd()
  },

  async '跑操' () {
    this.path = '/api/pe'
    this.method = 'GET'
    await this.next()
    let { count, detail, remainDays } = this.body
    let remaining = Math.max(0, 45 - count)
    let lastTime = count && df.formatTimeNatural(detail.sort((a, b) => a - b).slice(-1)[0])
    return [
      `🥇 已跑操 ${count} 次，还有 ${remainDays} 天`,
      count && `上次跑操是在 ${lastTime}`,
      `💡 回复 体测 查看体测成绩`
    ].filter(k => k).join('\n\n').padd()
  },

  async '体测' () {
    this.path = '/api/pe'
    this.method = 'GET'
    await this.next()
    let { health } = this.body
    return [
      `🏓 最近一次体测成绩：`,
      health.map(k => `${k.name}：${k.value}（${k.score}，${k.grade}）`).join('\n')
    ].filter(k => k).join('\n\n').padd()
  },

  async '实验'() {
    this.path = '/api/phylab'
    this.method = 'GET'
    await this.next()
    let labs = this.body
    let now = new Date().getTime()
    let endedCount = labs.filter(k => k.endTime <= now).length
    let upcoming = labs.filter(k => k.startTime > now).sort((a, b) => a.startTime - b.startTime)
    let upcomingCount = upcoming.length
    let current = labs.filter(k => k.startTime <= now && k.endTime > now)
    let currentCount = current.length

    return [
      `🔬 已做 ${endedCount} 次实验，还有 ${upcomingCount} 次`,
      current.map(k => `正在进行：${k.labName} @ ${k.location}\n`).join(''),
      upcoming.map(k => `${df.formatPeriodNatural(k.startTime, k.endTime)}
        ${k.labName} @ ${k.location}`).join('\n\n')
    ].filter(k => k).join('\n\n').padd()
  },

  async '考试' () {
    this.path = '/api/exam'
    this.method = 'GET'
    await this.next()
    let exams = this.body
    let now = new Date().getTime()
    let endedCount = exams.filter(k => k.endTime <= now).length
    let upcoming = exams.filter(k => k.startTime > now).sort((a, b) => a.startTime - b.startTime)
    let upcomingCount = upcoming.length
    let current = exams.filter(k => k.startTime <= now && k.endTime > now)
    let currentCount = current.length

    return [
      `📝 已完成 ${endedCount} 场考试，还有 ${upcomingCount} 场`,
      current.map(k => `正在进行：${k.courseName} @ ${k.location}\n`).join(''),
      upcoming.map(k => `${df.formatPeriodNatural(k.startTime, k.endTime)}
        ${k.courseName} @ ${k.location}`).join('\n\n')
    ].filter(k => k).join('\n\n').padd()
  },

  default: '公众号正在施工中，如有功能缺失请谅解~',

  401: `绑定东南大学学生账号
    本科生：绑定 卡号 密码
    研究生：绑定 卡号 密码 研院密码
    例：绑定 213170000 mypassword

    🙈 密码全加密 小猴不偷你 🙈`.padd(),
    
  timeout: '请求超时，学校服务又挂啦 🙁',

  defaultError: '查询失败，请检查指令格式'
}

// 分割用户指令并进入相应 handler 函数中
const middleware = wechat(config).middleware(async (message, ctx) => {
  let [cmd, ...args] = message.Content.trim().split(/\s+/g)
  cmd = cmd.toLowerCase()
  ctx.request.headers.token = message.FromUserName
  ctx.message = message
  let han = handler[cmd] || handler.default
  if (han instanceof Function) {
    let originalPath = ctx.path
    let originalMethod = ctx.method
    try {
      let res = await Promise.race([
        han.call(ctx, ...args),
        new Promise((_, rej) => setTimeout(() => rej('timeout'), 5000))
      ])
      return res
    } catch (e) {
      let han = handler[e] || e && handler[e.message] || handler.defaultError
      if (han instanceof Function) {
        return await han.call(ctx, ...args)
      } else {
        return han
      }
    } finally {
      ctx.path = originalPath
      ctx.method = originalMethod
    }
  } else {
    return han
  }
})

module.exports = async (ctx, next) => {
  if (ctx.path.indexOf('/adapter-wx-herald/') === 0) {
    ctx.next = next
    await middleware.call(this, ctx, next)
  } else {
    await next()
  }
}