const mongodb = require('../../../database/mongodb')
const ObjectId = require('mongodb').ObjectId
const {adminList} = require('./admin.json')

exports.route = {
    async post({id}){
        let _id = ObjectId(id)
        let {cardnum} = this.user
        let lostAndFoundCollection = await mongodb("herald_lost_and_found")
        let record = await lostAndFoundCollection.findOne({_id})
        if([record.cardnum, ...adminList].indexOf(cardnum) === -1){
            throw 401
        }
        await lostAndFoundCollection.updateOne({_id}, {$set:{isFinished:true}})
        return 'success'
    }
}