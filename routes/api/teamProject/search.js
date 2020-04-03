exports.route = {
  /**
  * @api {GET} /api/teamProject/project 根据关键字/类别搜索
  * @apiGroup teamProject
  * 
  * @apiParam {String} key
  * @apiParam {String} selectedType
  * @apiParam {Number} page=1 页码
  * @apiParam {Number} pagesize=10 页面尺寸
  */
  async get({ key, selectedType, page = 1, pagesize = 10 }) {
    key = key ? key : ''
    key = '%' + key + '%'
    //搜索组队项目
    pagesize = +pagesize
    page = +page
    let startRow = (page - 1) * pagesize
    let endRow = page * pagesize
    let now = +moment()
    if (!selectedType) {
      let record = await this.db.execute(`
      SELECT * FROM (  
        SELECT T.*,ROWNUM R FROM (
          SELECT *
          FROM H_TEAM_PROJECT
          WHERE TITLE LIKE :key AND AUDITSTATUS = 'PASSED' AND ENDTIME > :now
          ORDER BY CREATEDTIME DESC
      )T)
      WHERE R > :startRow and R <= :endRow
      `, {
        key,
        now,
        startRow,
        endRow
      })
      return record.rows.map(Element => {
        let [id, title, createdTime, creatorCardnum, creatorName, projectDesc, skillRequirement, duartion, campus,
          category, otherRequirement, wantedNumber, nowNeedNumber, endTime, auditStatus] = Element
        return {
          id, title, createdTime, creatorCardnum, creatorName, projectDesc, skillRequirement, duartion, campus,
          category, otherRequirement, wantedNumber, nowNeedNumber, endTime, auditStatus
        }
      })
    } else {
      if (selectedType !== 'SRTP' && selectedType !== '竞赛' && selectedType !== '其它') {
        throw '参数不符合规范'
      }
      let record = await this.db.execute(`
      SELECT * FROM (  
        SELECT T.*,ROWNUM R FROM (
          SELECT *
          FROM H_TEAM_PROJECT
          WHERE TITLE LIKE :key AND AUDITSTATUS = 'PASSED' AND ENDTIME > :now AND category = :selectedType
          ORDER BY CREATEDTIME DESC
      )T)
      WHERE R > :startRow and R <= :endRow
      `, {
        key,
        now,
        selectedType,
        startRow,
        endRow
      })
      return record.rows.map(Element => {
        let [id, title, createdTime, creatorCardnum, creatorName, projectDesc, skillRequirement, duartion, campus,
          category, otherRequirement, wantedNumber, nowNeedNumber, endTime, auditStatus] = Element
        return {
          id, title, createdTime, creatorCardnum, creatorName, projectDesc, skillRequirement, duartion, campus,
          category, otherRequirement, wantedNumber, nowNeedNumber, endTime, auditStatus
        }
      })
    }
  }
}