const mongodb = require('../../../database/mongodb')
const ObjectId = require('mongodb').ObjectId
const moment = require('moment')
const { adminList } = require('./adminList.json')

exports.route = {
    // 创建申请信息
    async post({ teamProjectId, majority, skill, qqNum, email, phoneNum, desc }) {
        let { cardnum, name } = this.user
        let teamParticipationCollection = await mongodb("herald_team_participation")
        let teamProjectCollection = await mongodb("herald_team_project")
        let grade = cardnum.slice(3, 5)
        let record = await teamProjectCollection.findOne({ _id: ObjectId(teamProjectId) })
        if (!record) {
            throw '项目不存在'
        }
        if (!(qqNum && email && phoneNum)) {
            throw '缺少联系方式'
        }
        if (!(majority && skill & desc)) {
            throw '内容不完整'
        }
        await teamParticipationCollection.insertOne({
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