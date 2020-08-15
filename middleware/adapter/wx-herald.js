/**
 * wx-herald 小猴偷米微信公众号中间件
 */
const wechat = require('co-wechat')

//方便本地调试
let config
try {
  config = require('../../sdk/sdk.json').wechat['wx-herald']
} catch (e) {
  console.log('wx-herald未配置')
}

const api = require('../../sdk/wechat').getAxios('wx-herald')

const crypto = require('crypto')


String.prototype.padd = function () {
  return this.split('\n').map(k => k.trim()).join('\n').trim()
}

// 生产环境更新自定义菜单
// TEST:修改的过程也先自定义菜单
if (program.mode === 'production') {
  const menu = require('./wx-herald-menu.json')
  api.post('/menu/create', menu).then(res => {
    console.log(chalkColored.blue('[wx-herald] 自定义菜单 ') + res.data.errmsg)
  })
}

// 各种功能的 handler 函数或对象
const handler = {
  async '菜单|功能|菜單|選單'() {
    let user
    try {
      this.path = '/api/user'
      this.method = 'GET'
      await this.next()
      let { name, identity } = this.body
      user = `${name}（${identity}）`
    } catch (e) {
      user = '未登录'
    }

    return `🐵 小猴偷米微信功能菜单
          👥 ${user}

          课表 跑操 体测 一卡通
          实验 考试 成绩 SRTP
          图书 奖助 通知 讲座
          空教室 App下载 
          ----------------
          【跑操提醒服务】
          - 开启跑操提醒
          - 关闭跑操提醒

          💡 回复关键词使用对应功能`.padd()
  },

  async '绑定|登录|登陆|綁定|登錄'() {
    this.path = '/api/wechatAuth'
    this.method = 'POST'
    await this.next()
    if (this.body === '已经绑定') {
      return `👥 ${this.user.name}（${this.user.cardnum}）`
    }
    else {
      const authUrl = `https://newids.seu.edu.cn/authserver/login?goto=https://tommy.seu.edu.cn/wx-login/?sessionid=${this.body}`

      return `<a href="${authUrl}">🔗点击进行统一身份验证</a>`
    }

  },

  // async '手机卡'() {


  //   //let token = await accessToken('wx-herald')
  //   //console.log(token)

  //   //客服消息回复图片,永久添加图片
  //   return { type: 'image', content: 'V0B7CYkN4lHoVoFrs63HZTbLCIHsvi-YgZgrctk4kU0' }

  // },

  async '一卡通|消费|余额|流水|消費|餘額'(date) {
    this.path = '/api/card'
    this.method = 'GET'
    this.query = this.params = { date }
    await this.next()
    let { info, detail } = this.body
    let total = (- detail.map(k => k.amount).filter(k => k < 0).reduce((a, b) => a + b, 0)).toFixed(2)
    return [
      `💳 一卡通余额 ${info.balance}`,
      `${date || '今日'} 总支出 ${total} 元`,
      detail.map(k => {
        let time = moment(k.time).fromNow()
        let amount = k.amount.toFixed(2).replace(/^(?:\d)/, '+')
        return date ? `${k.desc} ${amount}` : `${time}：${k.desc} ${amount}`
      }).join('\n'),
      date ? '' : '💡 可查指定日期，注意日期前加空格且保证月份及日期为两位，例如：一卡通 2018-03-17'
    ].filter(k => k).join('\n\n').padd()
  },

  async '课|課|课程表|課程表'() {
    this.path = '/api/curriculum'
    this.method = 'GET'
    await this.next()

    let { curriculum } = this.body
    curriculum = curriculum.map(course => {
      let { courseName, location, events = [] } = course
      return events.map(e => Object.assign(e, { courseName, location }))
    }).reduce((a, b) => a.concat(b), [])

    let now = +moment()
    let endedCount = curriculum.filter(k => k.endTime <= now).length
    let upcoming = curriculum.filter(k => k.startTime > now).sort((a, b) => a.startTime - b.startTime)
    let upcomingCount = upcoming.length
    let current = curriculum.filter(k => k.startTime <= now && k.endTime > now)
    // let currentCount = current.length
    const pwaUrl = 'https://myseu.cn/#/'
    return [
      `🗓 本学期已上 ${endedCount} 课，还有 ${upcomingCount} 课`,
      current.map(k => `正在上课：${k.courseName} @ ${k.location}\n`).join(''),
      upcoming.slice(0, 5).map(k => `${moment(k.startTime).fromNow()}
        ${k.courseName} @ ${k.location}`).join('\n\n'),
      `💡 完整课表详见<a href="${pwaUrl}">网页版</a>或小程序`,
      `👍你也可以回复App下载，获取最新版的小猴偷米App以及全新的界面与功能的体验`
    ].filter(k => k).join('\n\n').padd()
  },

  // async '预测|預測'() {
  //   this.path = '/api/course'
  //   this.method = 'GET'
  //   this.query = this.params = { term: 'next' }
  //   await this.next()

  //   let courses = this.body

  //   return courses.length ? [
  //     `🗓 你下学期可能有 ${courses.length} 门课`,
  //     courses.map(k => `
  //       ${k.courseName} (${k.credit} 学分)
  //       ${k.avgScore ? `平均参考成绩 ${k.avgScore} (样本容量 ${k.sampleCount})` : ''}
  //     `.padd()).join('\n\n'),
  //   ].filter(k => k).join('\n\n').padd() : '🗓 你所在的院系年级样本不足，暂无记录'
  // },

  async '空教室|教室'(building = '') {
    let hour = +moment().format('HH')
    let minute = +moment().format('mm')

    if (hour >= 21 || (hour >= 20 && minute >= 55)) {
      return '🙈 已经没有教室在上课啦！不过小猴提醒你还是要早点休息哦～'
    }

    this.path = '/api/classroom/current'
    this.method = 'GET'
    await this.next()

    let currentMap = {}
    let nextMap = {}

    let result = this.body

    result.forNext = result.forNext ? result.forNext : []
    result.nextTimeDesc = result.nextTimeDesc ? result.nextTimeDesc : ''

    result.forCurrent.forEach(k => {
      k = k.split('-')
      if (!currentMap[k[0]]) {
        currentMap[k[0]] = []
      }
      currentMap[k[0]].push(k[1])
    })

    result.forNext.forEach(k => {
      k = k.split('-')
      if (!nextMap[k[0]]) {
        nextMap[k[0]] = []
      }
      nextMap[k[0]].push(k[1])
    })

    result.forNext = []
    result.forCurrent = []

    let buildingInNum = {
      '1': '教一',
      '2': '教二',
      '3': '教三',
      '4': '教四',
      '6': '教六',
      '7': '教七',
      '8': '教八'
    }

    console.log(building)

    Object.keys(buildingInNum).forEach(k => {
      if (building.indexOf(k) !== -1) {
        building = buildingInNum[k]
      }
    })


    let buildings = ['教一', '教二', '教三', '教四', '教六', '教七', '教八']

    if (buildings.indexOf(building) != -1) {
      buildings = [building]
    } else {
      if (building != '') {
        return '正确示例：“空教室 教一”'
      }
    }

    buildings.forEach(k => {
      if (currentMap[k]) {
        result.forCurrent.push(
          `${k}：\n${currentMap[k].join('，')}`
        )
      }
    })

    buildings.forEach(k => {
      if (nextMap[k]) {
        result.forNext.push(
          `${k}：\n${nextMap[k].join('，')}`
        )
      }
    })

    result = [
      '📚小猴偷米空教室查询',
      `${result.currentTimeDesc}`,
      ...result.forCurrent,
      `${result.nextTimeDesc}`,
      ...result.forNext
    ].join('\n\n')

    if (result.length > 1000) {
      return '🤔现在的空教室太多了，请按教学楼查询吧～ 例如【空教室 教一】'
    }

    return result
  },

  // async '选修|選修'() {
  //   this.path = '/api/course/optional'
  //   this.method = 'GET'
  //   await this.next()

  //   let courses = this.body

  //   return [
  //     '🗓 选修课程排行 Top 10',
  //     courses.map(k => `
  //       ${k.courseName} (${k.courseType})
  //       ${k.avgScore ? `平均参考成绩 ${k.avgScore} (样本容量 ${k.sampleCount})` : ''}
  //     `.padd()).join('\n\n'),
  //   ].filter(k => k).join('\n\n').padd()
  // },

  async '跑操管理员'() {
    let md5 = crypto.createHash('md5')
    let openidHash = md5.update(this.openid).digest('hex')
    return openidHash
  },

  async '跑操通知'(message) {
    this.path = '/api/pe/setMorningExercise'
    this.method = 'POST'
    this.params.message = message
    await this.next()

    let result = this.body
    return result
  },

  async '开启跑操提醒|设置跑操提醒|開啟跑操提醒|設置跑操提醒'() {
    this.path = '/api/exerciseNotification'
    this.method = 'GET'
    await this.next()
    // 检测是否设置成功
    if (this.body === '设置成功') {
      await api.post('message/template/send', {
        touser: this.openid,
        // template_id: 'q-o8UyAeQRSQfvvue1VWrvDV933q1Sw3esCusDA8Nl4',
        template_id: 'Cy71tABe4ccV6eJp80fAFGGwme96XUNoxJWl7vL2Oqs',
        data: {
          first: {
            value: '✅ 跑操提醒服务开启成功\n'
          },
          keyword1: {
            value: '东南大学'
          },
          keyword2: {
            value: '小猴偷米'
          },
          keyword3: {
            value: '' + String(moment().format('YYYY-MM-DD'))
          },
          keyword4: {
            value: '\n\n已开启小猴偷米跑操提醒服务，每日跑操预报信息发布时您将会收到提醒。 \n\n如需关闭提醒，请前往小猴偷米公众号发送关键字【取消跑操提醒】。'
          }
        }
      })
    } else {
      return '开启失败，请稍后重试或联系管理员'
    }

  },

  async '关闭跑操提醒|取消跑操提醒|關閉跑操提醒|取消跑操提醒'() {
    this.path = '/api/exerciseNotification'
    this.method = 'DELETE'
    await this.next()
    // 检查是否删除成功
    if (this.body === '删除成功') {
      await api.post('message/template/send', {
        touser: this.openid,
        // template_id: 'q-o8UyAeQRSQfvvue1VWrvDV933q1Sw3esCusDA8Nl4'
        template_id: 'Cy71tABe4ccV6eJp80fAFGGwme96XUNoxJWl7vL2Oqs',
        data: {
          first: {
            value: '⛔️ 跑操提醒服务已关闭\n'
          },
          keyword1: {
            value: '东南大学'
          },
          keyword2: {
            value: '小猴偷米'
          },
          keyword3: {
            value: '' + String(moment().format('YYYY-MM-DD'))
          },
          keyword4: {
            value: '\n\n已关闭小猴偷米跑操提醒服务。 \n\n如需再次开启，请前往小猴偷米公众号发送关键字【开启跑操提醒】。'
          }
        }
      })
    } else {
      return '未开启跑操提醒'
    }
  },

  async '跑操|早操|锻炼|鍛煉'() {
    this.path = '/api/pe'
    this.method = 'GET'
    await this.next()
    let { count, detail, remainDays } = this.body
    //let remaining = Math.max(0, 45 - count)
    let lastTime = count && moment(detail.sort((a, b) => a - b).slice(-1)[0]).fromNow()
    return [
      `🥇 已跑操 ${count} 次，还有 ${remainDays} 天`,
      count && `上次跑操是在${lastTime}`,
      '💡 回复 体测 查看体测成绩',
      '💡 回复 开启跑操提醒 体验跑操提醒服务'
    ].filter(k => k).join('\n\n').padd()
  },

  async '体测|體測'() {
    this.path = '/api/pe'
    this.method = 'GET'
    await this.next()
    let { health } = this.body
    return [
      '🏓 最近一次体测成绩：',
      health.map(k => `${k.name}：${typeof (k.value) === 'number' ? k.value.toString().slice(0, k.value.toString().indexOf('.') === -1 ? undefined : k.value.toString().indexOf('.') + 3) : k.value}` + ((k.grade || k.score) ? (k.grade && `（${k.score}，${k.grade}）`) : '')).join('\n')

    ].filter(k => k).join('\n\n').padd()
  },

  async '体育|體育'() {
    this.path = '/api/pe/exam'
    this.method = 'GET'
    await this.next()
    return [
      '💌 体育理论考试题库',
      this.body.map(k => `<a href="${k.url}">${k.title}</a>`).join(' '),
      '提示：数据来自学校官方公开的「大学体育国家级资源共享课程」。'
    ].join('\n\n').padd()
  },

  // async '实验|實驗'() {
  //   this.path = '/api/phylab'
  //   this.method = 'GET'
  //   await this.next()
  //   let labs = this.body
  //   let now = +moment()
  //   let endedCount = labs.filter(k => k.endTime <= now).length
  //   let upcoming = labs.filter(k => k.startTime > now).sort((a, b) => a.startTime - b.startTime)
  //   let upcomingCount = upcoming.length
  //   let current = labs.filter(k => k.startTime <= now && k.endTime > now)
  //   //let currentCount = current.length

  //   return [
  //     `🔬 已做 ${endedCount} 次实验，还有 ${upcomingCount} 次`,
  //     current.map(k => `正在进行：${k.labName} @ ${k.location}\n`).join(''),
  //     upcoming.map(k => `${moment(k.startTime).fromNow()}
  //       ${k.labName} @ ${k.location}`).join('\n\n')
  //   ].filter(k => k).join('\n\n').padd()
  // },

  async '考试|考試|測驗'() {
    this.path = '/api/exam'
    this.method = 'GET'
    await this.next()
    let exams = this.body
    let now = +moment()
    let endedCount = exams.filter(k => k.endTime <= now).length
    let upcoming = exams.filter(k => k.startTime > now).sort((a, b) => a.startTime - b.startTime)
    let upcomingCount = upcoming.length
    let current = exams.filter(k => k.startTime <= now && k.endTime > now)
    //let currentCount = current.length

    return [
      `📝 已完成 ${endedCount} 场考试，还有 ${upcomingCount} 场`,
      current.map(k => `正在进行：${k.courseName} @ ${k.location}\n`).join(''),
      upcoming.map(k => `${moment(k.startTime).fromNow()}
        ${k.courseName} @ ${k.location}`).join('\n\n')
    ].filter(k => k).join('\n\n').padd()
  },

  async '绩|績|绩点|績點|成绩|成績'() {
    this.path = '/api/gpa'
    this.method = 'GET'
    await this.next()
    let { gpa, gpaBeforeMakeup, score, credits, detail } = this.body
    console.log(this.body)
    let info
    if (gpa) { // 本科生
      info = `绩点：${gpa}（首修 ${gpaBeforeMakeup}）`
    } else { // 研究生
      info = `平均规格化成绩：${score}
        已修学分：${credits.degree} + ${credits.optional}
        应修学分：${credits.required}`.padd()
    }
    return [
      `📈 ${info}`,
      detail[0].courses.map(k => `${k.courseName} (${k.scoreType})
        ${k.score} - ${k.credit} 学分`).join('\n\n')
    ].filter(k => k).join('\n\n').padd()
  },

  async '讲座|講座'() {
    this.path = '/api/lecture'
    this.method = 'GET'
    await this.next()
    let lectures = this.body
    return [
      `🎬 已听讲座次数：${lectures.length}`,
      lectures.map(k => `【打卡时间】${moment(k.time).format('YYYY-M-D')} \n【打卡地点】${k.location} ${k.lectureTitle ? '\n【讲座主题】' + k.lectureTitle : ''} ${k.lectureUrl ? '\n【讲座详情】' + k.lectureUrl : ''}`).join('\n---------------------\n')
    ].filter(k => k).join('\n\n').padd()
  },

  async '图书|圖書'() {
    this.path = '/api/library'
    this.method = 'GET'
    await this.next()
    let books = this.body
    return [
      `📖 已借图书：${books.length}`,
      books.map(k => `${k.name}（${k.author}）
      应还：${moment(k.returnDate).format('YYYY-M-D')}`).join('\n')
    ].filter(k => k).join('\n\n').padd()
  },

  // 暂无数据
  // async '奖助|獎助'() {
  //   this.path = '/api/scholarship'
  //   this.method = 'GET'
  //   await this.next()
  //   let { scholarshipList, scholarshipApplied, stipendList, stipendApplied } = this.body
  //   let list = scholarshipList.concat(stipendList)
  //   let applied = scholarshipApplied.concat(stipendApplied)
  //   return [
  //     '🔑 可申请奖助学金：',
  //     list.map(k => k.name).join('\n'),
  //     '🔑 已申请奖助学金：',
  //     applied.map(k => `${k.name}（${k.endYear} ${k.state}）`).join('\n')
  //   ].filter(k => k).join('\n\n').padd()
  // },

  async '通知|公告'() {
    this.path = '/api/notice'
    this.method = 'GET'
    await this.next()
    let notices = this.body
    return [
      '📨 最近通知：',
      notices.slice(0, 5).map(k => `${k.category} ${moment(k.time).calendar()}
        <a href="${k.url || 'https://myseu.cn/?nid=' + k.nid}">${k.title}</a>`).join('\n\n')
    ].filter(k => k).join('\n\n').padd()
  },

  async 'srtp|研学|研學'() {
    this.path = '/api/srtp'
    this.method = 'GET'
    await this.next()
    let { info, projects } = this.body
    return [
      `🚀 SRTP 学分：${info.points}（${info.grade}）`,
      projects.map(k => `${k.project}
        ${k.type} ${k.date} ${k.credit}分`).join('\n\n')
    ].filter(k => k).join('\n\n').padd()
  },

  async '宿舍|寝室|公寓'() {
    this.path = '/api/dorm'
    this.method = 'GET'
    await this.next()
    let { campus, SSFJH } = this.body
    if (SSFJH) {
      return [
        '🏠 你的宿舍：',
        `${campus} ${SSFJH}`
      ].join('\n').padd()
    }
    return '🏠 你暂时没有分配宿舍'
  },

  // async 'App|APP|下载'() {

  //   return `🐵 小猴偷米 App 下载地址

  //   iOS用户请直接在应用商店搜索：小猴偷米

  //   Android用户新版下载地址：
  //   https://hybrid.myseu.cn/herald-app-6.apk
  //   （请复制到浏览器打开）


  //   注意：部分安卓商店提供早已过期的版本，无法正常登录。
  //   `.padd()

  // },


  // 测试统一身份认证小程序
  async 'IDS认证'() {
    return '<a href="https://myseu.cn" data-miniprogram-appid="wxaef6d2413690047f" data-miniprogram-path="pages/index?IDS_SESSION=herald_fake_ids_session&FORCE=1&APPID=wxf71117988eadfed0">统一身份认证登录</a>'
  },

  default: `🤔 命令无法识别

    💡 回复 菜单 查看功能列表
    💡 所有命令与参数之间均有空格`.padd(),

  401: `🤔 账号未绑定、绑定失败或失效
    🔗 请按以下格式绑定微信账号

    本科生格式：
    绑定 卡号 统一身份认证密码

    💡 所有命令与参数之间均有空格
    🙈 密码及缓存经过交叉加密保护`.padd(),

  timeout: '请求超时，学校服务又挂啦 🙁',

  defaultError: e => {
    console.error(e)
    return `🤔 命令执行出错，请检查命令格式

    💡 回复 菜单 查看功能列表
    💡 所有命令与参数之间均有空格`.padd()
  }
}

let middleware

try {
  // 分割用户指令并进入相应 handler 函数中
  middleware = wechat(config).middleware(async (message, ctx) => {
    let han, args
    if (message.Content) {
      let [cmd, ...tmpArgs] = message.Content.trim().split(/\s+/g)
      han = handler[Object.keys(handler).find(k => new RegExp(k, 'i').test(cmd)) || 'default']
      args = tmpArgs
    } else {
      han = 'default'
      args = []
    }
    ctx.request.headers['x-api-token'] = message.FromUserName
    ctx.fromWechat = true
    ctx.message = message

    let openid = message.FromUserName
    ctx.openid = openid

    new Promise(() => {
      (async () => {
        if (han instanceof Function) {
          let originalPath = ctx.path
          let originalMethod = ctx.method
          try {
            return await han.call(ctx, ...args)
          } catch (e) {
            if (e instanceof Error && ~e.message.indexOf('timeout')) {
              // eslint-disable-next-line no-ex-assign
              e = 'timeout'
            }
            let han = handler[e] || handler.defaultError(e)
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
      })().then((msg) => {
        if (!msg) {
          return ''
        }
        if (msg === 'default') {
          return ''
        }
        try {
          if (msg.type === 'image') {
            api.post('/message/custom/send', {
              'touser': openid,
              'msgtype': 'image',
              'image':
              {
                'media_id': msg.content
              }
            })
          }
          else {
            api.post('/message/custom/send', {
              'touser': openid,
              'msgtype': 'text',
              'text':
              {
                'content': msg
              }
            })
          }
        } catch (e) {
          console.log('向微信服务器推送消息失败')
        }
      })
    })
    return ''
  })
} catch (e) {
  console.log('wx-herald未配置')
}


module.exports = async (ctx, next) => {
  if (ctx.path.indexOf('/adapter-wx-herald/') !== -1) {
    console.log(ctx.path.endsWith('wechat'))
    // if (program.mode === 'development' && ctx.path.endsWith('wechat') && ctx.method === 'GET') {
    if (program.mode === 'production' && ctx.path.endsWith('wechat') && ctx.method === 'GET') {
      // 微信测试
      ctx.path = '/api/wechatAuth'
      await next()
    }
    ctx.next = next
    await middleware.call(this, ctx, next)
    ctx.wx = true
  } else {
    await next()
  }
}