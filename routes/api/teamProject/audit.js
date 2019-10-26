const mongodb = require('../../../database/mongodb')
const ObjectId = require('mongodb').ObjectId
const { adminList } = require('./adminList.json')

exports.route = {
    // 管理员获得待审核的列表
    async get({ pagesize = 10, page = 1 }) {
        let { cardnum } = this.user
        let teamProjectCollection = await mongodb("herald_team_project")
        if (adminList.indexOf(cardnum)) {
            return await teamProjectCollection.find({ auditStatus: 'WAITING' }, { limit: pagesize, skip: (page - 1) * pagesize }).toArray()
        } else {
            return []
        }
    }

}