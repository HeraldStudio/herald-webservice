const mongodb = require('../../../database/mongodb')
const crypto = require('crypto')
const childProcess = require('child_process');
const accessToken = require('../../../sdk/wechat').getToken
exports.route = {
    async get() {
        let col = await mongodb('herald_morning_exercise')
        let date = moment().format('YYYY-MM-DD')
        let record = await col.findOne({ date })
        return record
    },

    async post({ sessionKey, state }) {
        let hours = +(moment().format('H'))
        if(hours > 8) {
            throw '当前时段不允许推送跑操通知'
        }
        let col = await mongodb('herald_morning_exercise')
        let md5 = crypto.createHash('md5');
        let sessionKeyMd5 = md5.update(sessionKey).digest('hex');
        let date = moment().format('YYYY-MM-DD')
        let record = await col.findOne({ date, sessionKeyMd5 })

        if (!record) {
            throw '非法访问'
        }

        if(state !== record.state){
            // 状态切换过程发送全体推送
            let templateMsg = {
                touser: [],
                template_id: "q-o8UyAeQRSQfvvue1VWrvDV933q1Sw3esCusDA8Nl4",
                data: {
                    first: {
                        value: ""
                    },
                    keyword1: {
                        value: "东南大学"
                    },
                    keyword2: {
                        value: "校学生会体育部"
                    },
                    keyword3: {
                        value: '' + String(moment().format("YYYY-MM-DD"))
                    },
                    keyword4: {
                        value: ""
                    }
                }
            }
            if(state === 'set'){
                templateMsg.data.first.value=`跑操提醒【今日跑操正常进行】\n`
                templateMsg.data.keyword4.value=`\n\n今日跑操正常进行，请按时参加`
            } else if(state === 'cancel'){
                templateMsg.data.first.value=`跑操提醒【今日跑操取消】\n`
                templateMsg.data.keyword4.value=`\n\n受天气状况影响，今日跑操取消`
            } else {
                throw '非法调用'
            }

            if(record.state !== 'pending'){
                // 跑操状态中途变更
                templateMsg.data.first.value=`【紧急通知】跑操安排调整\n`             
            }

            let subscriberCollection = await mongodb('herald_notification')
            let users = await subscriberCollection.find({ type: 'wechat', function: '跑操提醒' }).toArray()
            users = users.map( k => {return k.openid})
            templateMsg.touser = users
            templateMsg.accessToken = await accessToken('wx-herald')
            let pushJob = new Promise((resolve, reject) => {
                let pushProcess = new childProcess.fork("./worker/morningExerciseNotification.js")
                pushProcess.send(templateMsg)
                pushProcess.on('message',(msg)=>{
                    if(msg.success){
                        resolve(`共 ${msg.amount} 人订阅，${msg.count} 推送成功`)
                    }else{
                        resolve(`消息推送出错`)
                    }
                    pushProcess.kill()
                })
            })

            let result = await pushJob
            await col.updateMany({ date }, { $set: { state } })
            record = await col.findOne({ date })
            return result
        }

        return '跑操提醒状态设置成功'
    }
}