const mongodb = require('../../../database/mongodb')
const ObjectId = require('mongodb').ObjectId
const {adminList} = require('./admin.json')
const {deleteFile} = require('../../../sdk/qiniu')
exports.route = {
  async get({id='', type, page=1, pagesize=10}){
    let { cardnum } = this.user
    let lostAndFoundCollection = await mongodb('herald_lost_and_found')
    if(id){
      // 如果存在 id 则返回条目的信息
      let record = await lostAndFoundCollection.findOne({_id:ObjectId(id)})
      if(adminList.indexOf(cardnum) !== -1){
        record.canAudit = true
      }
      return record
    }
    // 确保分页的数据正确
    page = +page
    pagesize = +pagesize
    if(type === 'lost'){
      // 分页返回所有的失物招领
      return await lostAndFoundCollection.find({type:'lost', isAudit:true, isFinished:false},
        {limit:pagesize, skip:(page-1)*pagesize, sort:[['lastModifiedTime', -1]]}).toArray()
    } else if (type === 'found') {
      // 分页返回所有的寻物启事
      return await lostAndFoundCollection.find({type:'found', isAudit:true, isFinished:false},
        {limit:pagesize, skip:(page-1)*pagesize, sort:[['lastModifiedTime', -1]]}).toArray()
    } else if (type === 'audit') {
      // 分页返回所有的待审核事件
      if(adminList.indexOf(cardnum) === -1){
        // 只允许管理员查看
        return []
      }
      return (await lostAndFoundCollection.find({isAudit:false, isFinished:false},
        {limit:pagesize, skip:(page-1)*pagesize, sort:[['lastModifiedTime', -1]]}).toArray()).map( i => {
        i.canAudit = true
        return i
      })
    } else {
      // 什么都不指定就返回由自己创建的
      return await lostAndFoundCollection.find({creator:cardnum},
        {limit:pagesize, skip:(page-1)*pagesize, sort:[['lastModifiedTime', -1]]}).toArray()
    }
  },

  async post({type, title, describe, imageUrl}){
    let { cardnum } = this.user
    if(['lost', 'found'].indexOf(type) === -1){
      throw '事务类型不正确'
    }
    if(!title || title.length <= 0){
      throw '必须指定物品名称'
    }
    if(imageUrl && imageUrl.indexOf(`lf-${cardnum}`) === -1 ){
      throw '图片不合法'
    }
    let lostAndFoundCollection = await mongodb('herald_lost_and_found')
    await lostAndFoundCollection.insertOne({
      creator: cardnum,
      title,
      lastModifiedTime:+moment(),
      describe,
      imageUrl,
      type,
      isAudit:false,
      isFinished:false
    })
    return '提交成功'
  },

  async put({id, title, describe, imageUrl}){
    let { cardnum } = this.user
    id = ObjectId(id)
    let lostAndFoundCollection = await mongodb('herald_lost_and_found')
    let oldRecord = await lostAndFoundCollection.findOne({creator:cardnum, _id:id})
    if(imageUrl && imageUrl.indexOf(`lf-${cardnum}`) === -1 ){
      throw '图片不合法'
    }
    if(!oldRecord){
      throw '待修改事务不存在'
    }
    if(oldRecord.isFinished || oldRecord.isAudit){
      throw '不能修改已审核或者已标记完成的事务'
    }
    // 删除旧的 record 的图片
    if(oldRecord.imageUrl){
      oldRecord.imageUrl.split('|').forEach(url => deleteFile(url))
    }
    await lostAndFoundCollection.updateOne({_id:id}, {$set:{
      title: title ? title : oldRecord.title,
      describe: describe ? describe : oldRecord.describe,
      imageUrl: imageUrl,
      lastModifiedTime:+moment()
    }})
    return '修改成功'
  },

  async delete({id}){
    let { cardnum } = this.user
    let _id = ObjectId(id)
    let lostAndFoundCollection = await mongodb('herald_lost_and_found')
    let record = await lostAndFoundCollection.findOne({_id})
    // 管理员可以删除所有
    if([record.creator, ...adminList].indexOf(cardnum) === -1){
      throw 401
    }
    if(!record){
      throw '事务不存在'
    }
    if(record.imageUrl){
      record.imageUrl.split('|').forEach(url => deleteFile(url))
    }
    await lostAndFoundCollection.deleteOne({_id})
    return '删除成功'
  }
}