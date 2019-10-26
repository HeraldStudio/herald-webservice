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
    },
    // 删除申请信息
    async delete({ id }) {
        let { cardnum } = this.user
        let teamParticipationCollection = await mongodb("herald_team_participation")
        let record = await teamParticipationCollection.findOne({ _id: ObjectId(id) })
        if (!record) {
            throw '申请信息不存在'
        }
        if ([record.cardnum, ...adminList].indexOf(cardnum) === -1) {
            throw '权限不允许'
        }
        await teamParticipationCollection.deleteOne({ _id: ObjectId(id) })
        return '组队申请删除成功'
    },
    async get({ id = '', fromMe, page = 1, pagesize = 10 }) {
        let { cardnum } = this.user
        let _id = ObjectId(id)
        let teamParticipationCollection = await mongodb("herald_team_participation")
        // 如果id存在则返回该条目的信息
        if (id) {
            let record = await teamParticipationCollection.findOne({ _id })
            return record
        }
        // 查看本人的申请
        else if (fromMe) {
            return await teamParticipationCollection.find({ cardnum },
                { limit: pagesize, skip: (page - 1) * pagesize }).toArray()
        }
        // 查看本人收到的申请信息
        else{
            return await teamParticipationCollection.find({creatorCardnum:cardnum},
                { limit: pagesize, skip: (page - 1) * pagesize }).toArray()
        }
    }
}