const mongodb = requier('../../../database/mongodb')

exports.route = {
    async get({ key }) {
        //搜索组队项目
        let teamProjectCollection = await mongodb("herald_team_project")
        return await teamProjectCollection.find({
            title: { $regex: ".*" + key + ".*" },
            auditStatus: 'PASSED',
            endTime: { $gt: now }
        }, {
            limit: pagesize, skip: (page - 1) * pagesize,
            sort: [['createdTime', -1]]
        }).toArray()
    }
}