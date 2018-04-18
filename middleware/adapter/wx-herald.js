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
    return '绑定成功，回复 菜单 查看功能列表'
  },

  async '一卡通' (date) {
    this.path = '/api/card'
    this.method = 'GET'
    this.query = this.params = { date }
    await this.next()
    let { info, detail } = this.body
    return `💳 一卡通余额 ${info.balance}\n\n` + detail.map(k => {
      let time = df.formatTimeNatural(k.time)
      let amount = k.amount.toFixed(2).replace(/^(?:\d)/, '+')
      return `[${time}] ${k.desc} ${amount}元`
    }).join('\n') + (date ? '' : `
      
    💡 可查指定日期，注意日期前加空格，例如：一卡通 2018-3-17`.padd())
  },

  async '课表' (term) {
    this.path = '/api/curriculum'
    this.method = 'GET'
    this.query = this.params = { term }
    await this.next()

    let { curriculum } = this.body
    curriculum = curriculum.map(course => {
      let { courseName, location, events = [] } = course
      return events.map(e => Object.assign(e, { courseName, location }))
    }).reduce((a, b) => a.concat(b), [])

    let now = new Date().getTime()
    let endedCount = curriculum.filter(k => k.endTime <= now).length
    let upcoming = curriculum.filter(k => k.startTime > now).sort((a, b) => a.time - b.time)
    let upcomingCount = upcoming.length
    let current = curriculum.filter(k => k.startTime <= now && k.endTime > now)
    let currentCount = current.length

    return `🗓 本学期上了 ${endedCount} 节课，还有 ${upcomingCount} 节课\n\n` + 
      current.map(k => `🕒 正在上课：${k.courseName} @ ${k.location}\n`).join('') +
      upcoming.slice(1).map(k => `🕒 ${df.formatTimeNatural(k.startTime)}$：{k.courseName} @ ${k.location}\n`).join('') + `
      
      💡 登录网页版或小程序查看完整课表`.padd()
  },

  default: '公众号正在施工中，如有功能缺失请谅解~',

  401: '😵 该功能需要绑定使用：\n' +
    '本科生: 绑定 卡号 密码\n' +
    '研究生: 绑定 卡号 密码 研院密码\n' +
    '例: 绑定 213170000 mypassword\n' +
    '🙈 密码隐私全加密 小猴偷米不偷你 🙈',

  defaultError: '😵 查询失败，请检查指令格式'
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
      let res = await han.call(ctx, ...args)
      return res
    } catch (e) {
      let han = handler[e] || handler.defaultError
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