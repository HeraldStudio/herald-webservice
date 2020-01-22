const mongodb = require('../../../database/mongodb')
const ObjectId = require('mongodb').ObjectId
const {adminList} = require('./admin.json')

exports.route = {
  /**
   * POST /api/lostAndFound/audit
   * @param { id, pass } 
   * 审核接口
   */
  async post({id, pass}){
    let _id = ObjectId(id)
    let {cardnum} = this.user
    let lostAndFoundCollection = await mongodb('herald_lost_and_found')
    if(adminList.indexOf(cardnum) === -1) {
      throw 401
    }
    if(pass){
      await lostAndFoundCollection.updateOne({_id}, {$set:{isAudit:true, isFinished:false}})
    } else {
      await lostAndFoundCollection.updateOne({_id},{$set:{isAudit:false, isFinished:true}})
    }
    return 'success'
  }
}