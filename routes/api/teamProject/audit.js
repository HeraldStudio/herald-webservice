exports.route = {
  // 管理员获得待审核的列表
  async get({ pagesize = 10, page = 1 }) {
    if (await this.hasPermission('teamproject')) {
      pagesize = +pagesize
      page = +page
      let startRow = (page - 1) * pagesize
      let endRow = page * pagesize
      let record = await this.db.execute(`
      SELECT * FROM (  
        SELECT T.*,ROWNUM R FROM (
          SELECT title, createdTime, creatorCardnum, creatorName, projectDesc, skillRequirement, 
          duration, campus, category, otherRequirement, wantedNumber, nowNeedNumber, endTime
          FROM H_TEAM_PROJECT
          WHERE AUDITSTATUS = 'WAITING'
      )T)
      WHERE R > :startRow and R <= endRow
      `, {
        startRow,
        endRow
      })
      record = record.rows.map(Element => {
        let [title, createdTime, creatorCardnum, creatorName, projectDesc, skillRequirement,
          duration, campus, category, otherRequirement, wantedNumber, nowNeedNumber, endTime] = Element
        return {
          title, createdTime, creatorCardnum, creatorName, projectDesc, skillRequirement,
          duration, campus, category, otherRequirement, wantedNumber, nowNeedNumber, endTime
        }
      })
      return record
    } else {
      throw 403
    }
  },
  async put(id, isPassed) {
    if (await this.hasPermission('teamproject')) {
      if (isPassed) {
        try {
          await this.db.execute(`
          UPDATE H_TEAM_PROJECT
          SET AUDITSTATUS = 'PASSED'
          WHERE ID = :id
          `, { id })
        } catch (err) {
          throw '审核失败'
        }
      } else {
        try {
          await this.db.execute(`
          UPDATE H_TEAM_PROJECT
          SET AUDITSTATUS = 'REFUSED'
          WHERE ID = :id
          `, { id })
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