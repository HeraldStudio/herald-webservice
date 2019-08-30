const mongodb = require('../../../database/mongodb')
const {adminList} = require('./admin.json')
exports.route = {
    async get({type, page=1, pagesize=10}){
        let { cardnum } = this.user
        let lostAndFoundCollection = await mongodb("herald_lost_and_found")
        // 确保分页的数据正确
        page = +page
        pagesize = +pagesize
        if(type === 'lost'){
            // 分页返回所有的失物招领
            return await lostAndFoundCollection.find({type:"lost", isAudit:true, isFinished:false},
            {limit:pagesize, skip:(page-1)*pagesize, sort:[['lastModifiedTime', -1]]}).toArray()
        } else if (type === 'found') {
            // 分页返回所有的寻物启事
            return await lostAndFoundCollection.find({type:"found", isAudit:true, isFinished:false},
            {limit:pagesize, skip:(page-1)*pagesize, sort:[['lastModifiedTime', -1]]}).toArray()
        } else if (type === 'audit') {
            // 分页返回所有的待审核事件
            if(adminList.indexOf(cardnum) === -1){
                // 只允许管理员查看
                return []
            }
            return await lostAndFoundCollection.find({isAudit:false},
            {limit:pagesize, skip:(page-1)*pagesize, sort:[['lastModifiedTime', -1]]}).toArray()
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
            throw '必须指定事务标题'
        }
        if(imageUrl && !imageUrl.startsWith(`lf-${cardnum}`)){
            throw '图片不合法'
        }
        let lostAndFoundCollection = await mongodb("herald_lost_and_found")
        await lostAndFoundCollection.insertOne({
            creator: cardnum,
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
        let lostAndFoundCollection = await mongodb("herald_lost_and_found")
        let oldRecord = await lostAndFoundCollection.findOne({creator:cardnum, _id:id})
        if(imageUrl && !imageUrl.startsWith(`lf-${cardnum}`)){
            throw '图片不合法'
        }
        if(!oldRecord){
            throw '待修改事务不存在'
        }
        if(oldRecord.isFinished || oldRecord.isAudit){
            throw '不能修改已审核或者已标记完成的事务'
        }
        await lostAndFoundCollection.updateOne({_id:id}, {$set:{
            title: title ? title : oldRecord.title,
            describe: describe ? describe : oldRecord.describe,
            imageUrl: imageUrl ? imageUrl : oldRecord.imageUrl,
            lastModifiedTime:+moment()
        }})
        return '修改成功'
    },

    async delete({id}){
        let { cardnum } = this.user
        let lostAndFoundCollection = await mongodb("herald_lost_and_found")
        let record = await lostAndFoundCollection.findOne({_id:id, creator:cardnum})
        if(!record){
            throw '事务不存在'
        }
        // TODO:删除图片文件
        await lostAndFoundCollection.deleteOne({_id:id, creator:cardnum})
        return '删除成功'
    }
}