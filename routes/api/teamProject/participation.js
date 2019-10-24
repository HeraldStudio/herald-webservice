const mongodb = require('../../../database/mongodb')
const ObjectId = require('mongodb').ObjectId
const moment = require('moment')
const { adminList } = require('./adminList.json')

exports.route = {
    // 创建申请信息
    async post({ teamProjectId, majority, skill, qqNum, email, phoneNum, desc }) {
        let { cardnum, name } = this.user
        let grade = cardnum.indexOf('21316') !== -1 ? '大四' :
            cardnum.indexOf('21317') !== -1 ? '大三' :
                cardnum.indexOf('21318') !== -1 ? '大二' :
                    cardnum.indexOf('21319') !== -1 ? '大一' : ''
        let teamParticipation = await mongodb("herald_team_participation")
        let teamProject = await mongodb("herald_team_project")
        let record = await teamProject.findOne({ _id: ObjectId(teamProjectId) })
        if (!record) {
            throw '项目不存在'
        }
        if (!(qqNum && email && phoneNum)) {
            throw '缺少联系方式'
        }
        if (!(majority && skill & desc)) {
            throw '内容不完整'
        }
        await teamParticipation.insertOne({
            teamProjectId,
            cardnum,
            name,
            majority,
            grade,
            skill,
            qqNum,
            email,
            phoneNum,
            desc,
            isAccepted: false,     
            creatorCardnum: record.creatorCardnum,
            isRead: false
        })

        return "组队申请提交成功"
    }
}