/**
 * 跑操预测链接发送定时任务
 * 
 * 每日晚上7点发送跑操预测邮件给校会体育部相关的同学
 * 
 * 安全措施：
 * 生成 sessionKey - uuid/v4
 * 将 sessionKey 跟随邮件发送
 * 将 md5(sessionKey) 存入当日数据库
 * 请求时携带 sessionKey ，验证成功则设置当日跑操状态
 * 
 */
const emailTransport = (require('../sdk/email')).morningExerciseEmailTransporter
const mongodb = require('../database/mongodb')
const uuid = require('uuid/v4')
const schedule = require('node-schedule');
const crypto = require('crypto')

// 0点1分发送链接邮件
const job = schedule.scheduleJob('* 2 0 * * *',function(){
    setTimeout(async()=>{
        let morningExerciseCollection = await mongodb('herald_morning_exercise')
    let md5 = crypto.createHash('md5');
    let sessionKey = uuid()
    let sessionKeyMd5 = md5.update(sessionKey).digest('hex');
    let date = moment().format('YYYY-MM-DD')
    let record = await morningExerciseCollection.findOne({date})
    if(record){
        return
    } else {
        await morningExerciseCollection.insertOne({date, sessionKeyMd5, state:'pending'})
        let res = await emailTransport.sendMail({
                from: '小猴偷米跑操预报服务 <morning-exercise@myseu.cn>', // sender address
                to: 'gaoruihao@wolf-tungsten.com, 3084772927@qq.com', // list of receivers
                subject: '跑操预报设定', // Subject line
                text: [`请设定 ${moment().format('YYYY年MM月DD日')} 的跑操预报：`,
            `正常跑操请点击：https://myseu.cn/ws3/api/pe/setMorningExercise?sessionKey=${sessionKey}&state=set`,
            `跑操取消请点击：https://myseu.cn/ws3/api/pe/setMorningExercise?sessionKey=${sessionKey}&state=cancel`
            ].join('\n\n') // plain text body 
                })
            console.log(res)
        console.log(`/api/pe/setMorningExercise?sessionKey=${sessionKey}&state=set`)
        console.log(`/api/pe/setMorningExercise?sessionKey=${sessionKey}&state=cancel`)
    }
    }, (Math.random()+1)*3*1000)
});

module.exports = {job}



