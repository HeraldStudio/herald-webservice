const db = require('../../database/adapter')
const pubdb = require('../../database/publicity')
const { config } = require('../../app')
const axios = require('axios')

module.exports = async (ctx, next) => {
  if (ctx.params.uuid) {
    // 去除参数的 uuid，防止参数多变，污染 public redis 存储
    delete ctx.params.uuid
  }

  if (ctx.path.indexOf('/adapter-appserv/') === 0) {
    let originalPath = ctx.path
    ctx.path = ctx.request.path = ctx.path.replace('/adapter-appserv', '')

    // 对应路由的转换操作
    if (ctx.path === '/checkversion') {
      ctx.body = { content: {}, code: 200 }
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
        ctx.body.content.messages = wxappMessages
      }
      ctx.body.content.matchers = []

      // 小程序的登录提示不要了
      if (notices.length) {
        let link = `https://myseu.cn/#/notice/${notices[0].nid}`

        ctx.body.content.message = {
          image: '',
          content: notices[0].title,
          url: link
        }
      }

      let { schoolnum } = ctx.params
      let now = new Date().getTime()
      ctx.body.content.sliderviews = (await pubdb.banner.find({
        startTime: { $lte: now },
        endTime: { $gt: now }
      })).filter(k =>
        schoolnum.indexOf(k.schoolnumPrefix) === 0 ||
        !schoolnum && k.schoolnumPrefix === 'guest' ||
        schoolnum && k.schoolnumPrefix === '!guest'
      ).sort((a, b) => b.startTime - a.startTime).map(k => {
        return {
          title: k.title,
          imageurl: k.pic,
          url: k.url
        }
      })

      ctx.body.content.serverHealth = true
    } else if (ctx.path === '/download') {
      ctx.redirect('http://herald-app.oss-cn-shanghai.aliyuncs.com/app-release.apk')
    } else if (ctx.path.indexOf('/counter/') === 0) {
      ctx.body = ''
    } else if (ctx.path.indexOf('/wxapp/getfile/') === 0) {
      let url = ctx.path.replace('/wxapp/getfile/', '')
      let { data } = await axios.create(config.axios).get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/45.0.2454.101 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Encoding': 'gzip, deflate, sdch',
          'Accept-Language': 'zh-CN,zh;q=0.8',
          'Host': /\/([^/]+)/.exec(url)[1],
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        responseType: 'stream'
      })
      ctx.body = data
    } else if (ctx.path === '/wxapp/tomd') {
      let url = ctx.request.body
      let originalMethod = ctx.method
      ctx.path = '/api/notice'
      ctx.method = ctx.request.method = 'POST'
      ctx.params = { url }
      await next()
      ctx.method = originalMethod
      ctx.path = '/wxapp/tomd'
    } else if (ctx.path === '/charge') {
      let originalMethod = ctx.method
      ctx.path = '/api/card'
      ctx.method = ctx.request.method = 'PUT'
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
      } finally {
        ctx.method = originalMethod
        ctx.path = '/wxapp/charge'
      }
    }

    ctx.path = originalPath
  } else {
    await next()
  }
}
