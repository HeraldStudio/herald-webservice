const mongodb = require('../../../database/mongodb')
const ObjectId = require('mongodb').ObjectId

exports.route = {
  async get({itemId}){
    let {cardnum} = this.user
    let lostAndFoundCollection = await mongodb('herald_lost_and_found')
    let messageCollection = await mongodb('herald_lost_and_found_message')
    if(itemId){
      // 如果指定了事务id，首先获取事务记录
      itemId = ObjectId(itemId)
      let record = await lostAndFoundCollection.findOne({_id:itemId})
      if(!record){
        throw '事务不存在'
      }
      if(record.creator !== cardnum){
        // 如果不是自己创建的就去查找自己发的消息
        return await messageCollection.find({itemId, creator:cardnum}, {sort:[['lastModifiedTime', -1]]}).toArray()
      }
      // 如果是自己创建的就查找该事务的全部
      await messageCollection.updateMany({itemId}, {$set:{hasRead:true}}) // 标记为已读
      return await messageCollection.find({itemId}, {sort:[['lastModifiedTime', -1]]}).toArray()
    } else {
      // 没有指定 itemId 就要获取一个列表了
      let items = await lostAndFoundCollection.find({creator:cardnum, isAudit:true, isFinished:false},{projection:{'_id':1}}).toArray()
      let res = {}
      for(let itemId of items){
        res[itemId._id] = await messageCollection.countDocuments({itemId:ObjectId(itemId._id), hasRead:false}) 
      }
      return res
    }
  },
  async post({itemId, message}){
    if(!itemId){
      throw '未指定事务id'
    }
    if(!message || message.length === 0){
      throw '不能提交空消息'
    }
    itemId = ObjectId(itemId)
    let {cardnum} = this.user
    let lostAndFoundCollection = await mongodb('herald_lost_and_found')
    let messageCollection = await mongodb('herald_lost_and_found_message')
    let record = await lostAndFoundCollection.findOne({_id:itemId})
    if(record.isAudit && !record.isFinished){
      await messageCollection.insertOne({
        itemId:ObjectId(itemId),
        message,
        creator:cardnum,
        hasRead:false,
        lastModifiedTime:+moment()
      })
      return '回复成功'
    } else {
      throw '该事务未通过审核或已被关闭'
    }
  }
}