/**
 * wx-herald 小猴偷米微信公众号中间件
 */
const chalk = require('chalk')
const wechat = require('co-wechat')
const config = require('../../sdk/sdk.json').wechat['wx-herald']
const api = require('../../sdk/wechat').getAxios('wx-herald')

require('./ws2')// date format

// 生产环境更新自定义菜单
if (process.env.NODE_ENV === 'production') {
  const menu = require('./wx-herald-menu.json')
  api.post('/menu/create', menu).then(res => {
    console.log(chalk.blue('[wx-herald] 自定义菜单 ') + res.data.errmsg)
  })
}

// 各种功能的 handler 函数或对象
const handler = {
  '菜单': `🐵 小猴偷米功能菜单 [方括号表示可选参数]
🔗 绑定 一卡通号 统一身份认证密码 [研究生院密码]
💳 一卡通 📅 课表 🏃 跑操 🏓 体测
⚗️ 实验 📝 考试 📈 成绩 🎙 讲座
📚 图书 🏆 奖助 🔍 搜索 🔬 SRTP

⬇️ 点击 [小程序] 使用小程序版，戳 [<a href='myseu.cn'>这里</a>] 使用网页版`,

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
    this.params = { date }
    await this.next()
    let { info, detail } = this.body
    return `💳 卡余额 ${info.balance}\n` +
      detail.map(k => `[${new Date(k.time).format('H:mm')}] ${k.desc} [${k.amount}]`).join('\n')
  },

  default: '公众号正在施工中，如有功能缺失请谅解~',

  401: '😵 该功能需要正确绑定使用，请先绑定账号\n' +
    '[本科生指令]: 绑定 一卡通号 统一身份认证密码\n' +
    '[研究生指令]: 绑定 一卡通号 统一身份认证密码 研究生院密码\n' +
    '[例]: 绑定 213170000 mypassword\n' +
    '🙈 密码隐私全加密 小猴偷米不偷你 🙈',

  defaultError: '😵 数据获取失败，请检查指令格式或稍后再试'
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