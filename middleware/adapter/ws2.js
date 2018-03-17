const db = require('../../database/adapter')
const crypto = require('crypto')
const { config } = require('../../app')
const axios = require('axios')
const cheerio = require('cheerio')

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
    if (uuid && !/^0+$/.test(uuid)) {
      let existing = await db.auth.find({ uuid }, 1)
      if (!existing) {
        ctx.throw(401)
      }

      let { token } = existing

      // 重写请求 headers，插入 token，以便 ws3 下游识别
      ctx.request.headers.token = token
    }

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
          state: info.status,
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

      let startDate = new Date(term.startDate)
      content.startdate = {
        month: startDate.getMonth(), // 从0开始
        day: startDate.getDate()
      }

      ctx.body = { content, term: term.code, code: 200, sidebar }

    } else if (ctx.path === '/api/sidebar') {
      ctx.path = '/api/curriculum'
      await next()
      let sidebar = []
      let weekdays = 'Mon,Tue,Wed,Thu,Fri,Sat,Sun'.split(',')
      let { term, curriculum } = ctx.body
      curriculum.map(k => {
        if (!sidebar.find(j =>
            j.lecturer === k.teacherName
            && j.course === k.courseName
            && j.week === `${k.beginWeek}-${k.endWeek}`)) {
          sidebar.push({
            lecturer: k.teacherName,
            course: k.courseName,
            week: `${k.beginWeek}-${k.endWeek}`,
            credit: k.credit.toString()
          })
        }
      })

      ctx.body = { content: sidebar, code: 200 }

    } else if (ctx.path === '/api/emptyroom') {
      // FIXME 空教室暂无法获取
      ctx.body = { code: 400 }

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

      ctx.path = '/api/notice'
      await next()

      let content = {}
      ctx.body.map(k => {
        if (k.category !== '小猴通知') {
          if (!content[k.category]) {
            content[k.category] = []
          }
          content[k.category].push({
            date: new Date(k.time).format('yyyy-MM-dd'),
            href: k.url,
            title: k.title
          })
        }
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
      ctx.path = '/api/library'
      let { barcode } = ctx.params
      let { libCookie } = await db.auth.find({ uuid }, 1)

      let res = await axios.create(config.axios).get(
        'http://www.libopac.seu.edu.cn:8080/reader/book_lst.php',
        {
          headers: {
            "Cookie" : libCookie
          }
        }
      )
      let $ = cheerio.load(res.data)
      let bookList = $('#mylib_content tr').toArray().slice(1).map(tr => {
        let bookId = $(tr).find('td').toArray().map(td => {
          return $(td).text().trim()
        })[0]

        let borrowId = $(tr).find('input').attr('onclick').substr(20,8)

        return { bookId, borrowId }
      })

      bookList.forEach( book => {
        if(book['bookId'] === barcode) {
          ctx.params = { cookies: libCookie, bookId: barcode, borrowId: book['borrowId']}
        }
      })
      ctx.method = ctx.request.method = 'POST'
      await next()
      ctx.path = '/api/renew'

      let content = ctx.body
      if ( content === 'invalid call') {
        ctx.body = { content:'fail', code:400 }
      }else {
        ctx.body = { content, code:200 }
      }

    } else if (ctx.path === '/api/nic') {
      ctx.path = '/api/wlan'
      await next()
      let content = {
        web: {
          state: {
            active: `已开通，${ctx.body.connections.length} 个在线`,
            locked: '超额锁定',
            inactive: '未开通'
          }[ctx.body.state.service],
          used: ctx.body.usage.used.replace(/^(\d+)/, '$1 ')
        },
        left: ctx.body.balance.toString()
      }

      ctx.body = { content, code: 200 }

    } else if (ctx.path === '/api/pc') {
      // 跑操预告不再提供
      ctx.body = { content: 'refreshing', code: 201 }

    } else if (ctx.path === '/api/pe') {

      await next()
      ctx.body = {
        content: (ctx.body.count || 0).toString(),
        remain: ctx.body.remainDays,
        rank: '0',
        code: 200
      }

    } else if (ctx.path === '/api/pedetail') {

      ctx.path = '/api/pe'
      await next()

      ctx.body = {
        content: ctx.body.detail.map(k => {
          let date = new Date(k)
          return {
            sign_date: date.format('yyyy-MM-dd'),
            sign_time: date.format('h.mm'),
            sign_effect: '有效'
          }
        }),
        code: 200
      }

    } else if (ctx.path === '/api/phylab') {

      // 物理实验转换策略：与教务通知相似
      await next()

      let content = {
        '基础性实验(上)': [],
        '基础性实验(上)选做': [],
        '基础性实验(下)': [],
        '基础性实验(下)选做': [],
        '文科及医学实验': [],
        '文科及医学实验选做': []
      }
      ctx.body.map(k => {
        if (!content[k.type]) {
          content[k.type] = []
        }
        let date = new Date(k.startTime)
        let day = '上午'
        if (date.getHours() >= 12) {
          day = '下午'
        }
        if (date.getHours() >= 18) {
          day = '晚上'
        }
        content[k.type].push({
          'name': k.labName,
          // 本来括号里是第几周周几，但这里很难拿到第几周，前端也不用这个参数，就只写周几就好了
          'Date': date.format('yyyy年M月d日（EE）'),
          'Day': day,
          'Teacher': k.teacherName,
          'Address': k.location,
          'Grade': k.score
        })
      })
      ctx.body = { content, code: 200 }
    } else if (ctx.path === '/api/schoolbus') {
      ctx.body = {
        content: {
          weekend: {
            '前往地铁站': [
              {time: '8:00-9:30', bus: '每 30min 一班'},
              {time: '9:30-11:30', bus: '每 1h 一班'},
              {time: '11:30-13:00', bus: '每 30min 一班'},
              {time: '13:30-16:30', bus: '每 1h 一班'},
              {time: '17:00-19:00', bus: '每 30min 一班'},
              {time: '19:00-22:00', bus: '每 1h 一班'}
            ],
            '返回九龙湖': [
              {time: '8:00-9:30', bus: '每 30min 一班'},
              {time: '9:30-11:30', bus: '每 1h 一班'},
              {time: '11:30-13:00', bus: '每 30min 一班'},
              {time: '13:30-16:30', bus: '每 1h 一班'},
              {time: '17:00-19:00', bus: '每 30min 一班'},
              {time: '19:00-22:00', bus: '每 1h 一班'}
            ]
          },
          weekday:{
            '前往地铁站': [
              {time: '7:10-10:00', bus: '每 10min 一班'},
              {time: '10:00-11:30', bus: '每 30min 一班'},
              {time: '11:30-13:30', bus: '每 10min 一班'},
              {time: '13:30-15:00', bus: '13:30,14:00'},
              {time: '15:00-15:50', bus: '每 10min 一班'},
              {time: '16:00-17:00', bus: '16:00'},
              {time: '17:00-18:30', bus: '每 10min 一班'},
              {time: '18:30-22:00', bus: '每 30min 一班(20:30没有班车)'}
            ],
            '返回九龙湖': [
              {time: '7:10-10:00', bus: '每 10min 一班'},
              {time: '10:00-11:30', bus: '每 30min 一班'},
              {time: '11:30-13:30', bus: '每 10min 一班'},
              {time: '13:30-15:00', bus: '13:30,14:00'},
              {time: '15:00-15:50', bus: '每 10min 一班'},
              {time: '16:00-17:00', bus: '16:00'},
              {time: '17:00-18:30', bus: '每 10min 一班'},
              {time: '18:30-22:00', bus: '每 30min 一班(20:30没有班车)'}
            ]
          }
        },
        code: 200
      }
    } else if (ctx.path === '/api/srtp') {
      await next()
      let { info, projects } = ctx.body
      let content = [
        {
          score: info.grade,
          total: info.points.toString(),
          name: ctx.user.name,
          'card number': ctx.user.schoolnum
        }
      ].concat(projects.map(k => {
        return {
          credit: k.credit.toString(),
          proportion: k.proportion.toString(),
          project: k.project,
          department: k.department,
          date: k.date,
          type: k.type,
          'total credit': k.total.toString()
        }
      }))

      ctx.body = { content, code: 200 }

    } else if (ctx.path === '/api/term') {
      await next()
      let content = ctx.body.sort((a, b) => b.current - a.current).map(k => k.name)
      ctx.body = { content, code: 200 }

    } else if (ctx.path === '/api/user') {
      await next()
      let content = {
        sex: ctx.body.gender,
        cardnum: ctx.body.cardnum,
        name: ctx.body.name,
        schoolnum: ctx.body.schoolnum
      }
      ctx.body = { content, code: 200 }

    } else if (ctx.path === '/api/yuyue') {
      ctx.path = '/api/reservation'
      await next()
      ctx.body = {
        content: ctx.body,
        code: 200
      }
    } else if (ctx.path === '/api/library_hot') {
      ctx.body = { content: [], code: 200 }
    }

    // 还原原始 path 和 method 以便上游中间件处理
    ctx.path = originalPath
    ctx.method = originalMethod
  } else if (ctx.path === '/adapter-ws2/herald/api/v1/huodong/get') {
    let originalPath = ctx.path
    let { page, type } = ctx.query
    if (type === 'hot') {
      ctx.body = { content: [], code: 200 }
    } else {
      ctx.params = { page }
      ctx.path = '/api/activity'
      await next()
      ctx.path = originalPath
      ctx.body = {
        content: ctx.body.map(k => {
          let startTime = new Date(k.startTime).format('yyyy-M-d')
          let endTime = new Date(k.endTime).format('yyyy-M-d')
          return {
            title: k.title,
            introduction: k.content,
            start_time: startTime,
            end_time: endTime,
            activity_time: startTime + '~' + endTime,
            detail_url: k.url,
            pic_url: k.pic,
            association: '校园活动',
            location: '查看详情'
          }
        }),
        code: 200
      }
    }
  } else if (ctx.path === '/adapter-ws2/wechat2/lecture') {
    ctx.body = {
      content: [],
      code: 200
    }
  } else if (ctx.path === '/adapter-ws2/queryEmptyClassrooms/m') {
    ctx.body = '学校已经关闭空闲教室查询网站，小猴空闲教室功能失去数据源，无法继续提供服务，请知悉。'
  } else {
    await next()
  }
}
