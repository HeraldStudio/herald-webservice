const mongodb = require('../../../database/mongodb')
const ObjectId = require('mongodb').ObjectId

exports.route = {
  //同意组队申请
  async post({ participationId, isAgree = false }) {
    let teamParticipationCollection = await mongodb('herald_team_participation')
    let teamProjectCollection = await mongodb('herald_team_project')

    let recordOfParticipation = await teamParticipationCollection.findOne({
      _id: ObjectId(participationId)
    })
    if (!recordOfParticipation) {
      throw '申请不存在'
    }

    let recordOfProject = await teamProjectCollection.findOne({
      _id: ObjectId(recordOfParticipation.teamProjectId)
    })
    if (!recordOfProject) {
      throw '项目不存在'
    }


    // isAgree 同意申请
    if (isAgree) {

      if (recordOfProject.nowNeedNumber <= 0) {
        throw '项目人数已满'
      }

      await teamParticipationCollection.update(
        { _id: ObjectId(participationId) },
        { $set: { isAccepted: true, isRead: true } }
      )

      await teamProjectCollection.update(
        { _id: ObjectId(participationId) },
        { $set: { nowNeedNumber: recordOfProject.nowNeedNumber - 1 } }
      )
      return '同意申请成功'
    } else {
      await teamParticipationCollection.update(
        { _id: ObjectId(participationId) },
        { $set: { isRead: true } }
      )
      return '已读'
    }




  }
}