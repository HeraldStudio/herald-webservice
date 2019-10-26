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

        let record_Project = await teamProjectCollection.findOne({
            _id: ObjectId(record_Participation.teamProjectId)
        })
        if(!record_Project){
            throw '项目不存在'
        }
        if(record_Project.nowNeedNumber<=0)
        {
            throw '项目人数已满'
        }else{
            await teamProjectCollection.update(
                {_id},
                {$set:{nowNeedNumber: record_Project.nowNeedNumber-1}}
            )
            return '同意申请成功'
        }
    }
}