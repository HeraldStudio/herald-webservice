const db = require('sqlongo')('adapter-ws2-auth')
const crypto = require('crypto')

db.auth = {
  uuid: 'text primary key',   // ws2 uuid
  cardnum: 'text not null',   // 一卡通号，用于识别用户是否已存在
  token: 'text not null',     // 对应的 ws3 token
  libPwd: 'text not null',    // 上次保存的图书馆密码
  libCookie: 'text not null', // 上次使用的图书馆 Cookie
}

Date.prototype.format = function (format) {
  let o = {
    'M+': this.getMonth() + 1, //月份
    'd+': this.getDate(), //日
    'h+': this.getHours() % 12 === 0 ? 12 : this.getHours() % 12, //小时
    'H+': this.getHours(), //小时
    'm+': this.getMinutes(), //分
    's+': this.getSeconds(), //秒
    'q+': Math.floor((this.getMonth() + 3) / 3), //季度
    'S': this.getMilliseconds() //毫秒
  }
  let week = ['日', '一', '二', '三', '四', '五', '六']
  if (/(y+)/.test(format)) {
    format = format.replace(RegExp.$1, (this.getFullYear() + '').substr(4 - RegExp.$1.length))
  }
  if (/(E+)/.test(format)) {
    format = format.replace(RegExp.$1, ((RegExp.$1.length > 1) ? (RegExp.$1.length > 2 ? '星期' : '周') : '') + week[this.getDay()])
  }
  for (let k in o) {
    if (new RegExp('(' + k + ')').test(format)) {
      format = format.replace(RegExp.$1, (RegExp.$1.length === 1) ? (o[k]) : (('00' + o[k]).substr(('' + o[k]).length)))
    }
  }
  return format.replace(/N?aN/g, '')
}

module.exports = async (ctx, next) => {

  // 代替 herald_auth 中的 AuthHandler.py，只提供 auth，不提供 deauth
  if (ctx.path === '/adapter-ws2/uc/auth') {
    let { user, password } = ctx.params // 对 appid 容错

    // 转换为对 ws3 auth 请求
    ctx.path = '/auth'
    ctx.params = { cardnum: user, password, platform: 'adapter-ws2' }
    await next()

    // 能执行到此处说明认证成功
    // 取返回值中的 token
    let token = ctx.body

    // 首先在数据库中查找是否已有对应 uuid
    // 如果已有，根据 ws2 行为应当优先保留已有的 uuid，更新其对应的 ws3 token
    let existing = await db.auth.find({ cardnum: user }, 1)
    if (existing) {
      await db.auth.update({ cardnum: user }, { token })
      ctx.body = existing.uuid
    } else {
      // 模仿 ws2 行为生成 20 字节（40 个十六进制字符）uuid，与 token 一起存入数据库
      // 由于 ws2 本身就是无加密的，因此此处也只能无加密存储 token，无法提供进一步的隐私保护
      // 因此各客户端应尽快升级对接 ws3 接口以提供安全的隐私保护
      let uuid = new Buffer(crypto.randomBytes(20)).toString('hex')
      await db.auth.insert({ uuid, cardnum: user, token, libPwd: '', libCookie: '' })
      ctx.body = uuid
    }
    // 还原原始 path 以便上游中间件处理
    ctx.path = '/adapter-ws2/uc/auth'

  // 代替 herald_auth 中的 APIHandler.py，对 uuid 解析转换成 ws3 token
  } else if (ctx.path.indexOf('/adapter-ws2/api/') === 0) {

    let { uuid } = ctx.params
    let existing = await db.auth.find({ uuid }, 1)
    if (!existing) {
      ctx.throw(401)
    }

    let { token } = existing

    // 重写请求 headers，插入 token，以便 ws3 下游识别
    ctx.request.headers.token = token

    // 将路由转换成 /api/...，且为默认 GET 请求
    let originalPath = ctx.path, originalMethod = ctx.method
    ctx.path = ctx.request.path = ctx.path.replace('/adapter-ws2', '')
    ctx.method = ctx.request.method = 'GET'

    // 对应路由的转换操作
    // 因为 next 只能调用一次，所以无法进行一对多的转换，ws2 的一个接口最多只能对应请求 ws3 的一个接口。

    if (ctx.path === '/api/card') {

      // 一卡通转换策略：timedelta 大于 1 时，只取昨天流水；小于或等于 1 或无参数时，只取当日流水。
      let { timedelta } = ctx.params

      if (timedelta && timedelta > 1) {
        let yesterday = new Date(new Date().getTime() - 1000 * 60 * 60 * 24)
        ctx.params.date = `${yesterday.getFullYear()}-${yesterday.getMonth() + 1}-${ yesterday.getDate() }`
      }

      await next()

      let { info, detail } = ctx.body
      detail = detail.map(k => {
        return {
          date: new Date(k.time).format('yyyy/MM/dd HH:mm:ss'),
          price: k.amount.toString(),
          type: '',
          system: k.desc,
          left: k.balance.toString()
        }
      })

      ctx.body = {
        content: {
          cardLeft: info.balance.toString(),
          left: info.balance.toString(),
          state: info.status.mainStatus,
          detail, 'detial': detail
        }, code: 200
      }
    } else if (ctx.path === '/api/curriculum') {
      await next()
      let content = {}, sidebar = []
      let weekdays = 'Mon,Tue,Wed,Thu,Fri,Sat,Sun'.split(',')
      weekdays.map(k => content[k] = [])
      let { term, curriculum } = ctx.body
      curriculum.map(k => {
        if (!sidebar.find(j => j.lecturer === k.teacherName && j.course === k.courseName)) {
          sidebar.push({
            lecturer: k.teacherName,
            course: k.courseName,
            week: `${k.beginWeek}-${k.endWeek}`,
            credit: k.credit.toString()
          })
        }
        if (k.dayOfWeek) {
          content[weekdays[k.dayOfWeek - 1]].push([
            k.courseName,
            `[${k.beginWeek}-${k.endWeek}周]${k.beginPeriod}-${k.endPeriod}节`,
            `${{none:'',odd:'(单)',even:'(双)'}[k.flip]}${k.location}`
          ])
        }
      })

      // 当前学期开学日期硬编码一下
      if (term.code === '17-18-3') {
        content.startdate = { day: 26, month: 1 }
      }

      ctx.body = { content, term: term.code, code: 200, sidebar }

    } else if (ctx.path === '/api/exam') {
      await next()
      let content = ctx.body.map(k => {
        return {
          course: k.courseName,
          type: k.courseType,
          teacher: k.teacherName,
          time: new Date(k.startTime).format('yyyy-M-d H:mm(E)'),
          location: k.location,
          hour: k.duration.toString()
        }
      })
      ctx.body = { content, code: 200 }

    } else if (ctx.path === '/api/gpa') {
      await next()
      let { gpa, gpaBeforeMakeup, calculationTime, detail } = ctx.body
      let content = [
        {
          'calculate time': calculationTime ? new Date(calculationTime).format('yyyy-MM-dd HH:mm:ss') : '',
          'gpa without revamp': gpaBeforeMakeup.toString(),
          'gpa': gpa.toString()
        }
      ].concat(detail.map(k => k.courses.map(course => {
        return {
          name: course.courseName,
          extra: course.courseType,
          credit: course.credit.toString(),
          semester: k.semester,
          score: course.score,
          type: course.scoreType
        }
      })).reduce((a, b) => a.concat(b), []))

      ctx.body = { content, code: 200 }

    } else if (ctx.path === '/api/jwc') {

      // 教务通知转换策略：不提供「最新动态」，其他分类视 ws3 筛选条件而定，只保留筛选后有通知的分类
      await next()

      let content = {}
      ctx.body.map(k => {
        if (!content[k.category]) {
          content[k.category] = []
        }
        content[k.category].push({
          date: new Date(k.time).format('yyyy-MM-dd'),
          href: k.url,
          title: k.title
        })
      })
      ctx.body = { content, code: 200 }

    } else if (ctx.path === '/api/lecture') {
      await next()

      let detail = ctx.body.map(k => {
        return {
          date: new Date(k.time).format('yyyy-MM-dd HH:mm:ss'),
          place: k.location
        }
      })

      ctx.body = { content: { count: detail.length, 'detial': detail }, code: 200 }

    } else if (ctx.path === '/api/library') {
      let { libPwd } = await db.auth.find({ uuid }, 1)
      ctx.params.password = libPwd

      try {
        await next()
      } catch (e) {
        if (typeof e === 'string' && /密码错误/.test(e)) {
          ctx.body = {
            content: '密码错误',
            code: 401
          }
          return
        }
      }

      await db.auth.update({ uuid }, { libCookie: ctx.body.cookies })

      let content = ctx.body.bookList.map(k => {
        return {
          barcode: k.bookId,
          title: k.name,
          author: '',
          render_date: k.borrowDate,
          due_date: k.returnDate,
          renew_time: k.times,
          place: k.place
        }
      })

      ctx.body = { content, code: 200 }

    } else if (ctx.path === '/api/renew') {
      let { barcode } = ctx.params
      let { libCookie } = await db.auth.find({ uuid }, 1)

      // FIXME ws3 图书馆续借需要两个 id 参数，ws2 只需要一个，理论上两个更准确一些，
      // 但这里为了符合 ws2 接口是不是要跟 ws2 一样通过遍历列表搜索一下 borrowId？
      ctx.body = { content, code: 400 }
    }

    // 还原原始 path 和 method 以便上游中间件处理
    ctx.path = originalPath
    ctx.method = originalMethod
  } else {
    await next()
  }
}
