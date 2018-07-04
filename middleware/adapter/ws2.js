const crypto = require('crypto')
const { config } = require('../../app')
const axios = require('axios')
const cheerio = require('cheerio')
const pubdb = require('../../database/publicity')

module.exports = async (ctx, next) => {
  if (ctx.path.indexOf('/adapter-ws2/') !== 0) {
    return await next()
  }

  let originalPath = ctx.path
  let originalMethod = ctx.method
  try {
    // 代替 herald_auth 中的 AuthHandler.py，只提供 auth，不提供 deauth
    if (ctx.path === '/adapter-ws2/uc/auth') {
      let { user, password } = ctx.params // 对 appid 容错

      // 根据头部特征识别具体平台
      let { 'user-agent': ua, 'accept-language': lang } = ctx.request.headers
      let platform = 'ws2'
      if (!ua && lang) {
        platform += '-ios'
      } else if (/okhttp/i.test(ua)) {
        platform += '-android'
      } else if (/iphone/i.test(ua)) {
        platform += '-mina-ios'
      } else if (/android/i.test(ua)) {
        platform += '-mina-android'
      } else if (/devtools/i.test(ua)) {
        platform += '-mina-devtools'
      }

      // 转换为对 ws3 auth 请求
      ctx.path = '/auth'
      ctx.params = { cardnum: user, password, platform: 'ws2' }
      await next()

      // 代替 herald_auth 中的 APIHandler.py，对 uuid 解析转换成 ws3 token
    } else if (ctx.path.indexOf('/adapter-ws2/api/') === 0) {

      let { uuid } = ctx.params
      if (uuid) {
        // 去除参数的 uuid，防止参数多变，污染 public redis 存储
        delete ctx.params.uuid
        ctx.request.headers.token = uuid
      }

      // 将路由转换成 /api/...，且为默认 GET 请求
      ctx.path = ctx.path.replace('/adapter-ws2', '')
      ctx.method = 'GET'

      // 对应路由的转换操作
      // 因为 next 只能调用一次，所以无法进行一对多的转换，ws2 的一个接口最多只能对应请求 ws3 的一个接口。

      if (ctx.path === '/api/card') {

        // 一卡通转换策略：timedelta 大于 1 时，只取昨天流水；小于或等于 1 或无参数时，只取当日流水。
        let { timedelta } = ctx.params

        if (timedelta && timedelta > 1) {
          ctx.request.body = ctx.params = { date: moment().subtract(1, 'days').format('YYYY-M-D') }
        } else {
          ctx.request.body = ctx.params = {}
        }

        await next()

        let { info, detail } = ctx.body
        detail = (detail || []).map(k => {
          return {
            date: moment(k.time).format('YYYY/MM/DD HH:mm:ss'),
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
              `${{ none: '', odd: '(单)', even: '(双)' }[k.flip]}${k.location}`
            ])
          }
        })

        let startDate = moment(term.startDate)
        content.startdate = {
          month: startDate.month(), // 从0开始
          day: startDate.date()
        }

        ctx.body = { content, term: term.name, code: 200, sidebar }

      } else if (ctx.path === '/api/sidebar') {
        ctx.path = '/api/curriculum'
        await next()
        let sidebar = []
        let weekdays = 'Mon,Tue,Wed,Thu,Fri,Sat,Sun'.split(',')
        let { curriculum } = ctx.body
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
            time: moment(k.startTime).format('YYYY-M-D H:mm(dddd)'),
            location: k.location,
            hour: k.duration.toString()
          }
        })
        ctx.body = { content, code: 200 }

      } else if (ctx.path === '/api/gpa') {
        await next()
        let { gpa, gpaBeforeMakeup, calculationTime, score, credits, detail } = ctx.body
        let content = (gpa ? [
          {
            'calculate time': calculationTime ? moment(calculationTime).format('YYYY-MM-DD HH:mm:ss') : '',
            'gpa without revamp': gpaBeforeMakeup.toString(),
            'gpa': gpa.toString()
          }
        ] : [ // 研究生暂时做个兼容
            {
              'calculate time': '',
              'gpa without revamp': score.toString(),
              'gpa': score.toString()
            }
          ]).concat(detail.map(k => k.courses.map(course => {
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
          if (k.site !== '小猴偷米') {
            k.category = k.site + ' - ' + (k.category || '通知公告')
            // App 只有名为「教务信息」的分类，才会显示在首页上
            let category = k.category === '教务处 - 教务信息' ? '教务信息' : k.category
            if (!content[category]) {
              content[category] = []
            }
            content[category].push({
              date: moment(k.time).format('YYYY-MM-DD'),
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
            date: moment(k.time).format('YYYY-MM-DD HH:mm:ss'),
            place: k.location
          }
        })

        ctx.body = { content: { count: detail.length, 'detial': detail }, code: 200 }

      } else if (ctx.path === '/api/library') {

        await next()
        let content = ctx.body.map(k => {
          return {
            barcode: k.bookId,
            title: k.name,
            author: k.author,
            render_date: moment(k.borrowDate).format('YYYY-MM-DD'),
            due_date: moment(k.returnDate).format('YYYY-MM-DD'),
            renew_time: k.renewCount,
            place: k.location
          }
        })

        ctx.body = { content, code: 200 }

      } else if (ctx.path === '/api/renew') {
        let { barcode: bookId } = ctx.params
        ctx.params = { bookId }

        ctx.path = '/api/library'
        ctx.method = 'POST'
        await next()

        let content = ctx.body
        if (content === 'invalid call') {
          ctx.body = { content: 'fail', code: 400 }
        } else {
          ctx.body = { content, code: 200 }
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
            let date = moment(k)
            return {
              sign_date: date.format('YYYY-MM-DD'),
              sign_time: date.format('H.mm'),
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
          let date = moment(k.startTime)
          let day = '上午'
          if (date.hour() >= 12) {
            day = '下午'
          }
          if (date.hour() >= 18) {
            day = '晚上'
          }
          content[k.type].push({
            'name': k.labName,
            // 本来括号里是第几周周几，但这里很难拿到第几周，前端也不用这个参数，就只写周几就好了
            'Date': date.format('YYYY年M月D日（ddd）'),
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
                { time: '8:00-9:30', bus: '每 30min 一班' },
                { time: '9:30-11:30', bus: '每 1h 一班' },
                { time: '11:30-13:00', bus: '每 30min 一班' },
                { time: '13:30-16:30', bus: '每 1h 一班' },
                { time: '17:00-19:00', bus: '每 30min 一班' },
                { time: '19:00-22:00', bus: '每 1h 一班' }
              ],
              '返回九龙湖': [
                { time: '8:00-9:30', bus: '每 30min 一班' },
                { time: '9:30-11:30', bus: '每 1h 一班' },
                { time: '11:30-13:00', bus: '每 30min 一班' },
                { time: '13:30-16:30', bus: '每 1h 一班' },
                { time: '17:00-19:00', bus: '每 30min 一班' },
                { time: '19:00-22:00', bus: '每 1h 一班' }
              ]
            },
            weekday: {
              '前往地铁站': [
                { time: '7:10-10:00', bus: '每 10min 一班' },
                { time: '10:00-11:30', bus: '每 30min 一班' },
                { time: '11:30-13:30', bus: '每 10min 一班' },
                { time: '13:30-15:00', bus: '13:30,14:00' },
                { time: '15:00-15:50', bus: '每 10min 一班' },
                { time: '16:00-17:00', bus: '16:00' },
                { time: '17:00-18:30', bus: '每 10min 一班' },
                { time: '18:30-22:00', bus: '每 30min 一班(20:30没有班车)' }
              ],
              '返回九龙湖': [
                { time: '7:10-10:00', bus: '每 10min 一班' },
                { time: '10:00-11:30', bus: '每 30min 一班' },
                { time: '11:30-13:30', bus: '每 10min 一班' },
                { time: '13:30-15:00', bus: '13:30,14:00' },
                { time: '15:00-15:50', bus: '每 10min 一班' },
                { time: '16:00-17:00', bus: '16:00' },
                { time: '17:00-18:30', bus: '每 10min 一班' },
                { time: '18:30-22:00', bus: '每 30min 一班(20:30没有班车)' }
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
        let content = ctx.body.list.sort((a, b) => b.current - a.current).map(k => k.name)
        ctx.body = { content, code: 200 }

      } else if (ctx.path === '/api/user') {
        await next()
        let { cardnum, name, schoolnum, gender: sex } = ctx.body

        // 由于老 App 要求，用户必须学号为八位才能登录成功
        // 因此对于研究生和教师，改为取一卡通后八位为学号
        if (!/^21/.test(cardnum)) {
          schoolnum = cardnum.slice(-8)
        }
        let content = {
          sex, cardnum, name, schoolnum
        }
        ctx.body = { content, code: 200 }
      } else if (ctx.path === '/api/yuyue') {
        ctx.path = '/api/reservation'
        ctx.method = 'GET'
        await next()
        ctx.body = {
          content: ctx.body,
          code: 200
        }
      } else if (ctx.path === '/api/library_hot') {
        ctx.body = { content: [], code: 200 }
      }
    } else if (ctx.path === '/adapter-ws2/click') {
      // 此处有大段解释，见 appserv.js:83
      // 续：这个请求是用于兼容老 App 的 WebView 点击，是浏览器发起的请求，没有登录态（headers 中没有 token）
      // 但因为轮播和活动的 adapter 路由中在 URL 中带了 [uuid] 控制指令，强制 App 传入 uuid
      // 作为参数（WS2 uuid 即为 WS3 token），因此可以在这个请求的 URL 参数中拿到用户的 token
      let { aid, bid, token } = ctx.query

      // 更旧版本的 App 不能识别 [uuid] 控制指令，会把 [uuid] 原样传回来；另外未登录态下，老 App 的 uuid 为全零
      // 这两种情况都要排除（保留非登录态），其余情况加上登录态
      if (/^[0-9A-Za-z]+$/.test(token) && !/^0+$/.test(token)) {
        // auth 中间件在 adapter 的下游，可以通过复写头部，强行加上登录态
        ctx.request.headers = { token }
      }

      // 无论是否有登录态都要做重定向
      if (aid) { // 点击活动
        ctx.path = '/api/activity'
      } else { // 点击轮播图
        ctx.path = '/api/banner'
      }
      ctx.method = 'PUT'

      // 下游是 WS3 PUT 请求，会进行统计记录，并返回目标链接，这里为了兼容，帮 App 做重定向
      await next()

      // 因为把原始 url 封装起来导致 App 无法替换原始 url 中的 [uuid] 控制指令，因此这里帮 App 做替换
      let url = ctx.body
      url = url.replace(/\[uuid\]/g, token)
      return ctx.redirect(url)
    } else if (ctx.path === '/adapter-ws2/herald/api/v1/huodong/get') {
      let { page = 1, type } = ctx.query
      if (type === 'hot') {
        ctx.body = { content: [], code: 200 }
      } else {
        let acts = await pubdb.activity.find({}, 10, (page - 1) * 10, 'startTime-')
        ctx.body = {
          content: acts.map(k => {
            let startTime = moment(k.startTime).format('YYYY-M-D')

            // 截止时间减去1毫秒，使得0点的回到前一天23:59，防止误导
            let endTime = moment(k.endTime - 1).format('YYYY-M-D')
            return {
              title: k.title,
              introduction: k.content,
              start_time: startTime,
              end_time: endTime,
              activity_time: startTime === endTime ? startTime : startTime + '~' + endTime,

              // 此处有大段解释，见 appserv.js:83
              detail_url: k.url && `https://myseu.cn/ws3/adapter-ws2/click?aid=${k.aid}&token=[uuid]`,
              pic_url: k.pic,
              association: '校园活动',
              location: '…'
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
      ctx.redirect('http://map.seu.edu.cn/#/freeClassroom')
    } else if (ctx.path === '/adapter-ws2/static/images/xiaoli.jpg') {
      ctx.path = '/api/schedule'
      await next()
      ctx.redirect(ctx.body)
    } else {
      await next()
    }
  } finally {
    ctx.path = originalPath
    ctx.method = originalMethod
    ctx.status = ctx.body && ctx.body.code || 200
  }
}
