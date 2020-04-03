/**
 * @apiDefine teamProject 竞赛组队项目
 */
exports.route = {
  /**
  * @api {GET} /api/teamProject/audit 获得待审核的列表
  * @apiGroup teamProject
  * 
  * @apiParam {Number} page=1 页码
  * @apiParam {Number} pagesize=10 页面尺寸
  */
  async get({ pagesize = 10, page = 1 }) {
    if (await this.hasPermission('teamproject')) {
      pagesize = +pagesize
      page = +page
      let startRow = (page - 1) * pagesize
      let endRow = page * pagesize
      let now = +moment()
      let record = await this.db.execute(`
      SELECT * FROM (  
        SELECT T.*,ROWNUM R FROM (
          SELECT ID, title, createdTime, creatorCardnum, creatorName, projectDesc, skillRequirement, 
          duration, campus, category, otherRequirement, wantedNumber, nowNeedNumber, endTime, qqNum, email, phoneNum
          FROM H_TEAM_PROJECT
          WHERE AUDITSTATUS = 'WAITING' AND ENDTIME > :now
      )T)
      WHERE R > :startRow and R <= :endRow
      `, {
        now,
        startRow,
        endRow
      })
      record = record.rows.map(Element => {
        let [id, title, createdTime, creatorCardnum, creatorName, projectDesc, skillRequirement,
          duration, campus, category, otherRequirement, wantedNumber, nowNeedNumber, endTime] = Element
        return {
          id, title, createdTime, creatorCardnum, creatorName, projectDesc, skillRequirement,
          duration, campus, category, otherRequirement, wantedNumber, nowNeedNumber, endTime
        }
      })
      return record
    } else {
      throw 403
    }
  },
  /**
  * @api {POST} /api/teamProject/audit 审核组队
  * @apiGroup teamProject
  * 
  * @apiParam {String} teamProjectId
  * @apiParam {Boolean} isPassed
  */
  async post({ teamProjectId, isPassed }) {
    if (await this.hasPermission('teamproject')) {
      let record = await this.db.execute(`
      SELECT *
      FROM H_TEAM_PROJECT
      WHERE ID = :teamProjectId AND ENDTIME > :now AND AUDITSTATUS = 'WAITING'
      `, {
        teamProjectId,
        now: +moment()
      })
      if (record.rows.length === 0) {
        throw '目标项目不存在'
      }
      if (isPassed) {
        try {
          await this.db.execute(`
          UPDATE H_TEAM_PROJECT
          SET AUDITSTATUS = 'PASSED'
          WHERE ID = :teamProjectId
          `, { teamProjectId })
        } catch (err) {
          console.log(err)
          throw '审核失败'
        }
      } else {
        try {
          await this.db.execute(`
          UPDATE H_TEAM_PROJECT
          SET AUDITSTATUS = 'REFUSED'
          WHERE ID = :teamProjectId
          `, { teamProjectId })
        } catch (err) {
          throw '审核失败'
        }
      }

    } else {
      throw 403
    }
    return '审核成功'
  }
}