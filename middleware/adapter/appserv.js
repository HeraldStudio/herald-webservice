const pubdb = require('../../database/publicity')
const authdb = require('../../database/auth')
const { config } = require('../../app')
const crypto = require('crypto')
const axios = require('axios')

// 哈希算法，用于对 token 和密码进行摘要
const hash = value => {
  return Buffer.from(crypto.createHash('md5').update(value).digest()).toString('base64')
}

module.exports = async (ctx, next) => {
  if (ctx.path.indexOf('/adapter-appserv/') !== 0) {
    return await next()
  }

  let originalPath = ctx.path
  let originalMethod = ctx.method
  try {
    ctx.path = ctx.path.replace('/adapter-appserv', '')

    // 对应路由的转换操作
    if (ctx.path === '/checkversion') {
      let content = { serverHealth: true }
      try {
        let { uuid, versiontype } = ctx.params

        // 与 middleware/adapter/ws2.js:44 一致，快速更新用户的具体平台
        if (uuid && versiontype) {
          let auth = await authdb.auth.find({ tokenHash: hash(uuid) }, 1)
          if (auth && auth.platform === 'ws2') {
            let platform = 'ws2-' + versiontype.toLowerCase().replace('wxapp', 'mina')
            await authdb.auth.update({ tokenHash: hash(uuid) }, { platform })
          }
        }

        let notices = await pubdb.notice.find()

        // 每条系统通知对应转换为小程序的一条通知
        // 内容直接用 Markdown 代码
        // 地址直接用 Markdown 中找到的第一个链接地址
        let wxappMessages = notices.map(k => {
          let link = `https://myseu.cn/?nid=${k.nid}#/`
          return {
            image: '',
            title: k.title,
            content: k.content.substring(0, 100) + '…\n\n查看完整公告 >',
            url: link
          }
        })

        // 根据老版小程序设定，没有通知时应去掉 messages 数组
        if (wxappMessages.length) {
          content.messages = wxappMessages
        }
        content.matchers = []

        // 小程序的登录提示不要了
        if (notices.length) {
          let link = `https://myseu.cn/#/notice/${notices[0].nid}`

          content.message = {
            image: '',
            content: notices[0].title,
            url: link
          }
        }

        let { schoolnum = '' } = ctx.params
        let now = +moment()
        content.sliderviews = (await pubdb.banner.find({
          startTime: { $lte: now },
          endTime: { $gt: now }
        }, -1, 0, 'startTime-')).filter(k =>
          schoolnum.indexOf(k.schoolnumPrefix) === 0 ||
          !schoolnum && k.schoolnumPrefix === 'guest' ||
          schoolnum && k.schoolnumPrefix === '!guest'
        ).map(k => {
          return {
            title: k.title,
            imageurl: k.pic,

            // 再次强调，标准的前后端分离不应该有重定向 API，后端只负责提供数据，不应该控制浏览器做任何事
            // 因此在 WS3 中，任何带重定向的东西都不能放在普通路由中，只能作为终将废弃的 Adapter 存在
            // 这对于点击量统计来说是一件好事，因为传统的重定向方式在无 Cookie 模式下无法探测到是哪个用户点击了链接
            // 但为了兼容老 App，只能写一个重定向 API 来做这件事，因此就写到了 /adapter-ws2/click 这个路由中
            // 这里利用老 App 会把点击的 URL 中 [uuid] 替换成当前 WS2 uuid (WS3 token) 的特性，实现精确点击量统计
            // 当老 App 完全被替代之后，应该在前端废除原来那种不便于点击量统计的直链模式，转而使用 /api/activity
            // 和 /api/banner 的 Ajax PUT 请求来处理用户点击。
            url: k.url && `https://myseu.cn/ws3/adapter-ws2/click?bid=${k.bid}&token=[uuid]`
          }
        })
        ctx.body = { content, code: 200 }
      } catch (e) {
        console.error(e)
        ctx.body = { content, code: 200 }
      }
    } else if (ctx.path === '/download') {
      ctx.redirect('https://static.myseu.cn/herald-v1-final.apk')
    } else if (ctx.path.indexOf('/counter/') === 0) {
      ctx.body = ''
    } else if (ctx.path === '/charge') {
      ctx.path = '/api/card'
      ctx.method = 'PUT'
      try {
        await next()
        ctx.body = {
          retcode: 0,
          errmsg: ctx.body
        }
      } catch (e) {
        ctx.body = {
          retcode: 400,
          errmsg: e
        }
      }
    }
  } catch (e) {
    if (e instanceof Error) {
      console.trace(e)
    }
    ctx.body = {
      code: typeof e === 'number' ? e : 400
    }
  } finally {
    ctx.path = originalPath
    ctx.method = originalMethod
    ctx.status = ctx.body.code || ctx.body.retcode || 200
  }
}
