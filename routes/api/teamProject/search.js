const mongodb = require('../../../database/mongodb')

exports.route = {
  async get({ type,key, page=1, pagesize=10}) {
    //搜索组队项目
    console.log({type,key})
    let now = +moment()
    let teamProjectCollection = await mongodb('herald_team_project')
    if(!selectedType){
      return await teamProjectCollection.find({
        title: { $regex: '.*' + key + '.*' },
        auditStatus: 'PASSED',
        endTime: { $gt: now }
      }, {
        limit: pagesize, skip: (page - 1) * pagesize,
        sort: [['createdTime', -1]]
      }).toArray()
    }else{
      return await teamProjectCollection.find({
        title: { $regex: '.*' + key + '.*' },
        type: selectedType,
        auditStatus: 'PASSED',
        endTime: { $gt: now }
      }, {
        limit: pagesize, skip: (page - 1) * pagesize,
        sort: [['createdTime', -1]]
      }).toArray()
    }
  }
}