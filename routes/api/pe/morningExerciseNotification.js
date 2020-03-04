const crypto = require('crypto')
const childProcess = require('child_process')
const accessToken = require('../../../sdk/wechat').getToken
exports.route = {
  async get() {
    let date = moment().format('YYYY-MM-DD')
    let record = await this.db.execute(`
    SELECT * FROM H_MORNING_EXERCISE
    WHERE DATE_TIME = '${date}'
    `)
    record = record.rows.map(Element => {
      let [id, date_time, sessionKey, state] = Element
      return { id, date_time, sessionKey, state }
    })[0]
    return record
  },

  async post({ sessionKey, state }) {
    let hours = +(moment().format('H'))
    let minutes = +(moment().format('mm'))

    if (hours < 6 || hours > 8 || (hours == 7 && minutes > 20)) {
      throw '当前时段不允许推送跑操通知'
    }

    let md5 = crypto.createHash('md5')
    let sessionKeyMd5 = md5.update(sessionKey).digest('hex')
    let date = moment().format('YYYY-MM-DD')
    let record = await this.db.execute(`
    SELECT * FROM H_MORNING_EXERCISE
    WHERE DATE_TIME = '${date}' AND SESSIONKEY_MD5 = '${sessionKeyMd5}'
    `)
    record = record.rows.map(Element => {
      let [_id, date, sessionKeyMd5, state] = Element
      return { _id, date, sessionKeyMd5, state }
    })[0]
    if (!record) {
      throw '非法访问'
    }

    if (state !== record.state) {
      // 为了防止重复推送煞费苦心
      let updateResult = await this.db.execute(`
        UPDATE H_MORNING_EXERCISE SET STATE = :state
        WHERE DATE_TIME = '${date}'
      `, { state })
      if (updateResult.rowsAffected < 1) {
        throw '数据库错误，设置失败'
      }
      // 状态切换过程发送全体推送
      let templateMsg = {
        touser: [],
        // template_id: 'q-o8UyAeQRSQfvvue1VWrvDV933q1Sw3esCusDA8Nl4',
        template_id: 'Cy71tABe4ccV6eJp80fAFGGwme96XUNoxJWl7vL2Oqs',
        data: {
          first: {
            value: ''
          },
          keyword1: {
            value: '东南大学'
          },
          keyword2: {
            value: '校学生会体育部'
          },
          keyword3: {
            value: '' + String(moment().format('YYYY-MM-DD'))
          },
          keyword4: {
            value: ''
          }
        }
      }
      if (state === 'set') {
        templateMsg.data.first.value = '跑操提醒【今日跑操正常进行】\n'
        templateMsg.data.keyword4.value = '\n\n今日跑操正常进行，请按时参加'
      } else if (state === 'cancel') {
        templateMsg.data.first.value = '跑操提醒【今日跑操取消】\n'
        templateMsg.data.keyword4.value = '\n\n受天气状况影响，今日跑操取消'
      } else {
        throw '非法调用'
      }

      if (record.state !== 'pending') {
        // 跑操状态中途变更
        templateMsg.data.first.value = '【紧急通知】跑操安排调整\n'
      }
      let subscriber = await this.db.execute(`
      SELECT OPENID FROM H_EXERCISE_NOTIFICATION
      WHERE TYPE = 'wechat' AND FUNCTION ='跑操提醒'
      `)
      let users = subscriber.rows.map(Element => {
        let [openid] = Element
        return openid
      })
      templateMsg.touser = users
      templateMsg.accessToken = await accessToken('wx-herald')
      let pushJob = new Promise((resolve) => {
        let pushProcess = new childProcess.fork('./worker/morningExerciseNotification.js')
        pushProcess.send(templateMsg)
        pushProcess.on('message', (msg) => {
          if (msg.success) {
            resolve(`共 ${msg.amount} 人订阅，${msg.count} 推送成功`)
          } else {
            resolve('消息推送出错')
          }
          pushProcess.kill()
        })
      })

      let result = await pushJob
      return result
    }

    return '跑操提醒状态设置成功'
  }
}