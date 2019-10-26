const mongodb = require('../../../database/mongodb')
const ObjectId = require('mongodb').ObjectId
const moment = require('moment')
const { adminList } = require('./adminList.json')
exports.route = {
    //创建组队项目
    async post({ title, projectDesc, skillRequirement, duartion, campus, category, otherRequirement, wantedNumber, endTime }) {
        let { cardnum, name } = this.user
        let now = +moment()
        let teamProjectCollection = await mongodb("herald_team_project")
        // 防止发布过多的竞赛组队项目
        let recordCount = await teamProjectCollection.countDocuments({ creatorCardnum: cardnum, endTime: { $gt: now }, auditStatus: { $in: ['WAITING', 'PASSED'] } })
        if (recordCount > 3) {
            throw '发布的项目过多,请先完成当前的项目'
        }
        // 招募截止时间不能超过创建时间+15天
        if (endTime > now + 15 * 24 * 3600 * 1000) {
            throw '截止时间过长'
        }
        if (!(title && projectDesc && skillRequirement && campus && category && duartion && otherRequirement && (wantedNumber > 0))) {
            throw '项目信息不完整或不正确,请补全或者修改项目信息'
        }
        await teamProjectCollection.insertOne({
            title,
            createdTime: now,
            creatorCardnum: cardnum,
            creatorName: name,
            projectDesc,
            skillRequirement,
            duartion,
            campus,
            category,
            otherRequirement,
            wantedNumber,
            nowNeedNumber: wantedNumber,   //创建时候的默认值
            endTime,
            auditStatus: 'WAITING'
        })
        return '组队项目提交成功'

    },
    async delete({ id }) {
        let { cardnum } = this.user
        let _id = ObjectId(id)
        let teamProjectCollection = await mongodb("herald_team_project")
        let record = await teamProjectCollection.findOne({ _id })
        if (!record) {
            throw '项目不存在'
        }
        //管理员可以删除所有的竞赛组队项目
        if ([record.creatorCardnum, ...adminList].indexOf(cardnum) === -1) {
            throw '没有操作权限'
        }
        await teamProjectCollection.updateOne({ _id }, { $set: { endTime: +moment() } })

        return '删除成功'
    },
    async get({ id = '', fromMe, page = 1, pagesize = 10 }) {
        let { cardnum } = this.user
        let _id = ObjectId(id)
        let teamProjectCollection = await mongodb("herald_team_project")
        // 如果id存在则返回该条目的信息
        if (id) {
            let record = await teamProjectCollection.findOne({ _id })
            return  [{"isAdmin": true}, record]
        }
        // 查看本人发布的竞赛组队项目
        else if (fromMe) {
            return await teamProjectCollection.find({ creatorCardnum: cardnum },
                { limit: pagesize, skip: (page - 1) * pagesize, sort: [['createdTime', -1]] }).toArray()
        }
        // 啥都不指定就返回所有通过审核的组队项目，并且没有招满的组队项目
        else {
            return await teamProjectCollection.find({ auditStatus: 'PASSED', endTime: { $gt: now }, nowNeedNumber: { $gt: 0 } },
                { limit: pagesize, skip: (page - 1) * pagesize, sort: [['createdTime', -1]] }).toArray()
        }

    }
}