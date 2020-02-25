exports.route = {
  //同意组队申请
  async post({ participationId, isAgree = false }) {
    if(!participationId){
      throw '参数缺失'
    }
    let recordOfParticipation = await this.db.execute(`
    SELECT TEAMPROJECTID
    FROM H_TEAM_PARTICIPATION
    WHERE ID = :wid
    `, { wid: participationId })

    if (recordOfParticipation.rows.length === 0) {
      throw '申请不存在'
    }
    let participation
    recordOfParticipation.rows.map(Element => {
      let [teamProjectId] = Element
      participation = { teamProjectId }
    })

    let recordOfProject = await this.db.execute(`
    SELECT NOWNEEDNUMBER, ID, CREATORCARDNUM
    FROM H_TEAM_PROJECT
    WHERE ID = :wid
    `, { wid: participation.teamProjectId })
    if (recordOfProject.rows.length === 0) {
      throw '项目不存在'
    }
    let project
    recordOfProject.rows.map(Element => {
      let [nowNeedNumber, id, creator] = Element
      project = { nowNeedNumber, id, creator }
    })
    if(recordOfParticipation.creator !== this.user.cardnum){
      throw 403
    }
    // isAgree 同意申请
    if (isAgree) {
      if (project.nowNeedNumber <= 0) {
        throw '项目人数已满'
      }

      await this.db.execute(`
      UPDATE H_TEAM_PARTICIPATION
      SET ISACCEPTED = 1, ISREAD = 1
      WHERE ID = :wid
      `, {
        wid: participationId
      })
      await this.db.execute(`
      UPDATE H_TEAM_PROJECT
      SET NOWNEEDNUMBER = :num
      WHERE ID = :wid
      `,{
        num: project.nowNeedNumber - 1,
        wid: project.id
      })

      return '同意申请成功'
    } else {
      await this.db.execute(`
      UPDATE H_TEAM_PARTICIPATION
      SET ISREAD = 1
      WHERE ID = :wid
      `, {
        wid: participationId
      })
      return '已读'
    }
  }
}