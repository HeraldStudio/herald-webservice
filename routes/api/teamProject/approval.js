const mongodb = require('../../../database/mongodb')
const ObjectId = require('mongodb').ObjectId

exports.route = {
    //同意组队申请
    async post({ participationId }){
        let teamParticipationCollection = await mongodb("herald_team_participation")
        let teamProjectCollection = await mongodb("herald_team_project")
        let record_Participation = await teamParticipationCollection.findOne({ 
            _id: ObjectId(participationId)
        })
        if(!record_Participation){
            throw '申请不存在'
        }
        await teamParticipationCollection.update(
            {_id}, 
            {$set:{isAccepted:true}})

        record = await teamProjectCollection.find
    }
}