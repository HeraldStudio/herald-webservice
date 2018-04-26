const crypto = require('crypto')
const { config } = require('../../app')
const axios = require('axios')
const cheerio = require('cheerio')
const df = require('./date-format')

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
          let y = new Date(new Date().getTime() - 1000 * 60 * 60 * 24)
          ctx.params = { date: `${y.getFullYear()}-${y.getMonth() + 1}-${y.getDate()}` }
        } else {
          ctx.params = {}
        }

        await next()

        let { info, detail } = ctx.body
        detail = (detail || []).map(k => {
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
        let { gpa, gpaBeforeMakeup, calculationTime, score, credits, detail } = ctx.body
        let content = (gpa ? [
          {
            'calculate time': calculationTime ? new Date(calculationTime).format('yyyy-MM-dd HH:mm:ss') : '',
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
          if (k.category !== '小猴通知') {
            // App 只有名为「教务信息」的分类，才会显示在首页上
            let category = k.category === '教务处 - 教务信息' ? '教务信息' : k.category
            if (!content[category]) {
              content[category] = []
            }
            content[category].push({
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

        await next()
        let content = ctx.body.map(k => {
          return {
            barcode: k.bookId,
            title: k.name,
            author: k.author,
            render_date: new Date(k.borrowDate).format('yyyy-MM-dd'),
            due_date: new Date(k.returnDate).format('yyyy-MM-dd'),
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
    } else if (ctx.path === '/adapter-ws2/herald/api/v1/huodong/get') {
      let { page, type } = ctx.query
      if (type === 'hot') {
        ctx.body = { content: [], code: 200 }
      } else {
        ctx.params = { page }
        ctx.path = '/api/activity'
        await next()
        ctx.body = {
          content: ctx.body.map(k => {
            let startTime = new Date(k.startTime).format('yyyy-M-d')

            // 截止时间减去1毫秒，使得0点的回到前一天23:59，防止误导
            let endTime = new Date(k.endTime - 1).format('yyyy-M-d')
            return {
              title: k.title,
              introduction: k.content,
              start_time: startTime,
              end_time: endTime,
              activity_time: startTime === endTime ? startTime : startTime + '~' + endTime,
              detail_url: k.url,
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
  } catch (e) {
    ctx.body = {
      code: typeof e === 'number' ? e : 400
    }
  } finally {
    ctx.path = originalPath
    ctx.method = originalMethod
    ctx.status = ctx.body && ctx.body.code || 200
  }
}
