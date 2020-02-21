/**
 * 跑操预测链接发送定时任务
 * 
 * 每日凌晨0点0分发送跑操预测邮件给校会体育部相关的同学
 * 
 * 安全措施：
 * 生成 sessionKey - uuid/v4
 * 将 sessionKey 跟随邮件发送
 * 将 md5(sessionKey) 存入当日数据库
 * 请求时携带 sessionKey ，验证成功则设置当日跑操状态
 * 
 */
const emailTransport = (require('../sdk/email')).morningExerciseEmailTransporter
const uuid = require('uuid/v4')
const schedule = require('node-schedule')
const crypto = require('crypto')
const oracle = require('../database/oracle.js')
// 0点1分发送链接邮件
//const job = schedule.scheduleJob('30 * * * * *', function () {
// var rule1     = new schedule.RecurrenceRule()
// var times1    = [1,6,11,16,21,26,31,36,41,46,51,56]
// rule1.second  = times1
// const job = schedule.scheduleJob(rule1,function(){
const job = schedule.scheduleJob('*/10 * * * * *', function () {
  setTimeout(async () => {
    let db = await oracle.getConnection()
    let md5 = crypto.createHash('md5')
    let sessionKey = uuid()
    let sessionKeyMd5 = md5.update(sessionKey).digest('hex')
    let date = moment().format('YYYY-MM-DD')
    let record = await db.execute(`
    SELECT * FROM H_MORNING_EXERCISE
    WHERE DATE_TIME = '${date}'
    `)
    record = record.rows.map(Element => {
      let [id, date_time, sessionKey, state] = Element
      return { id, date_time, sessionKey, state }
    })[0]
    if (record) {
      db.close()
      return
    } else {
      await db.execute(`
      INSERT INTO H_MORNING_EXERCISE
      ( DATE_TIME, SESSIONKEY_MD5, STATE )
      VALUES
      ( '${date}', '${sessionKeyMd5}', 'pending' )
      `)
      db.close()
      let res = await emailTransport.sendMail({
        from: '小猴偷米跑操预报服务 <morning-exercise@myseu.cn>', // sender address
        // to: 'gaoruihao@wolf-tungsten.com, 3084772927@qq.com,1390796369@qq.com', // list of receivers
        //to: '1390796369@qq.com', // list of receivers
        to : '656598766@qq.com',
        subject: '跑操预报设定', // Subject line
        text: [`请设定 ${moment().format('YYYY年MM月DD日')} 的跑操预报：`,
          `跑操设定页面：https://myseu.cn/morningExerciseNotification/#/${sessionKey}`
        ].join('\n\n') // plain text body 
      })
      console.log(res)
    }
  }, (Math.random() + 1) * 3 * 1000)
})

module.exports = { job }



