const moment = require('moment')
exports.route = {
  //创建组队项目
  async post({ title, projectDesc, qqNum, email, phoneNum, skillRequirement, duartion, campus, category, otherRequirement, wantedNumber, endTime }) {
    let { cardnum, name } = this.user
    let now = +moment()
    let record = await this.db.execute(`
    SELECT *
    FROM H_TEAM_PROJECT
    WHERE CREATORCARDNUM = :cardnum AND ENDTIME > :now AND AUDITSTATUS IN ('WAITING', 'PASSED')
    `, {
      cardnum,
      now
    })
    let recordCount = record.rows.length
    if (recordCount >= 3) {
      throw '发布的项目过多,请先完成当前的项目'
    }
    // 招募截止时间不能超过创建时间+15天
    if (endTime > now + 15 * 24 * 3600 * 1000) {
      throw '截止时间过长'
    }
    if (!(title && projectDesc && skillRequirement && campus && category && duartion && otherRequirement && (wantedNumber > 0))) {
      throw '项目信息不完整或不正确,请补全或者修改项目信息'
    }
    if (category !== 'SRTP' && category !== '竞赛' && category !== '其它') {
      throw '参数不符合规范'
    }
    if (!(qqNum || email || phoneNum)) {
      throw '缺少联系方式'
    }
    try {
      await this.db.execute(`
      INSERT INTO H_TEAM_PROJECT
      (TITLE, CREATEDTIME, CREATORCARDNUM, CREATORNAME, PROJECTDESC, qqNum, email, phoneNum, SKILLREQUIREMENT, 
        DURATION, CAMPUS, CATEGORY, OTHERREQUIREMENT, WANTEDNUMBER, NOWNEEDNUMBER, ENDTIME, AUDITSTATUS)
      VALUES (:title, :createdTime, :creatorCardnum, :creatorName, :projectDesc, :qqNum, :email, :phoneNum, :skillRequirement, 
        :duartion, :campus, :category, :otherRequirement, :wantedNumber, :nowNeedNumber, :endTime, :auditStatus)
      `, {
        title,
        createdTime: now,
        creatorCardnum: cardnum,
        creatorName: name,
        projectDesc,
        qqNum: qqNum ? qqNum : null,
        email: email ? email : null,
        phoneNum: phoneNum ? phoneNum : null,
        skillRequirement,
        duartion,
        campus,
        category,
        otherRequirement,
        wantedNumber,
        nowNeedNumber: wantedNumber,   //创建时候的默认值
        endTime,
        auditStatus: 'WAITING'
      })
    } catch (err) {
      throw '组队项目提交失败'
    }
    return '组队项目提交成功'

  },
  async delete({ id, deleted }) {
    let { cardnum } = this.user
    if (deleted) {
      let record = await this.db.execute(`
      SELECT CREATORCARDNUM
      FROM H_TEAM_PROJECT
      WHERE ID = :id
      `, { id })
      if (record.rows.length === 0) {
        throw '项目不存在'
      }
      //管理员可以删除所有的竞赛组队项目
      if (!(record.rows[0][0] === cardnum || await this.hasPermission('teamproject'))) {
        throw '没有操作权限'
      }
      try {
        await this.db.execute(`
        DELETE FROM H_TEAM_PROJECT
        WHERE ID = :id
      `, {
          now: +moment(),
          id
        })
      } catch (err) {
        throw '删除失败'
      }

      return '删除成功'
    } else {
      let record = await this.db.execute(`
      SELECT CREATORCARDNUM
      FROM H_TEAM_PROJECT
      WHERE ID = :id
      `, { id })
      if (record.rows.length === 0) {
        throw '项目不存在'
      }
      //管理员可以删除所有的竞赛组队项目
      if (!(record.rows[0][0] === cardnum || await this.hasPermission('teamproject'))) {
        throw '没有操作权限'
      }
      try {
        await this.db.execute(`
        UPDATE H_TEAM_PROJECT
        SET ENDTIME = :now
        WHERE ID = :id
      `, {
          now: +moment(),
          id
        })
      } catch (err) {
        throw '结束失败'
      }

      return '结束成功'
    }

  },
  async get({ id = '', how, page = 1, pagesize = 10, }) {
    pagesize = +pagesize
    page = +page
    let startRow = (page - 1) * pagesize
    let endRow = page * pagesize
    let now = +moment()
    let { cardnum } = this.user
    // 如果id存在则返回该条目的信息
    if (id) {
      let record = await this.db.execute(`
      SELECT *
      FROM H_TEAM_PROJECT
      WHERE ID = :id
      `, { id })
      if (record.rows.length === 0) {
        throw '条目不存在'
      }
      let participation = await this.db.execute(`
      SELECT *
      FROM H_TEAM_PARTICIPATION
      WHERE TEAMPROJECTID = :teamprojectId
      `, {
        teamprojectId: record.rows[0][0]
      })
      if (record.rows[0][3] === this.user.cardnum || participation.rows.length !== 0) {
        return {
          hasJoined: true,
          project: record.rows.map(Element => {
            let [id, title, createdTime, creatorCardnum, creatorName, projectDesc, skillRequirement, duartion, campus,
              category, otherRequirement, wantedNumber, nowNeedNumber, endTime, auditStatus, qqNum, email, phoneNum] = Element
            return {
              id, title, createdTime, creatorCardnum, creatorName, projectDesc, skillRequirement, duartion, campus,
              category, otherRequirement, wantedNumber, nowNeedNumber, endTime, auditStatus, qqNum, email, phoneNum
            }
          })[0]
        }
      }else{
        return {
          hasJoined: false,
          project: record.rows.map(Element => {
            let [id, title, createdTime, creatorCardnum, creatorName, projectDesc, skillRequirement, duartion, campus,
              category, otherRequirement, wantedNumber, nowNeedNumber, endTime, auditStatus] = Element
            return {
              id, title, createdTime, creatorCardnum, creatorName, projectDesc, skillRequirement, duartion, campus,
              category, otherRequirement, wantedNumber, nowNeedNumber, endTime, auditStatus
            }
          })[0]
        }
      }
    }
    // 查看本人发布的竞赛组队项目
    else if (how) {
      if (how === 'create') {
        let record = await this.db.execute(`
        SELECT * FROM (  
          SELECT T.*,ROWNUM R FROM (
            SELECT *
            FROM H_TEAM_PROJECT
            WHERE CREATORCARDNUM = :cardnum
        )T)
        WHERE R > :startRow and R <= :endRow
        `, {
          cardnum,
          startRow,
          endRow
        })
        return record.rows.map(Element => {
          let [id, title, createdTime, creatorCardnum, creatorName, projectDesc, qqNum, email, phoneNum, skillRequirement, duartion, campus,
            category, otherRequirement, wantedNumber, nowNeedNumber, endTime, auditStatus] = Element
          return {
            id, title, createdTime, creatorCardnum, creatorName, projectDesc, qqNum, email, phoneNum, skillRequirement, duartion, campus,
            category, otherRequirement, wantedNumber, nowNeedNumber, endTime, auditStatus
          }
        })
      }
      // 查看本人提交了申请的项目 
      else if (how === 'submit') {
        let record = await this.db.execute(`
        SELECT * FROM (  
          SELECT T.*,ROWNUM R FROM (
            SELECT A.ID PARTICIPATIONID, B.*
            FROM (
              SELECT TEAMPROJECTID, ID
              FROM H_TEAM_PARTICIPATION
              WHERE CARDNUM =:cardnum
            ) A
            LEFT JOIN(
              SELECT *
              FROM H_TEAM_PROJECT
            )B
            ON A.TEAMPROJECTID = B.ID
        )T)
        WHERE R > :startRow and R <= :endRow
        `, {
          cardnum,
          startRow,
          endRow
        })
        if(record.rows.length === 0){
          return []
        }
        return record.rows.map(Element => {
          let [participationId, id, title, createdTime, creatorCardnum, creatorName, projectDesc, skillRequirement, duartion, campus,
            category, otherRequirement, wantedNumber, nowNeedNumber, endTime, auditStatus, qqNum, email, phoneNum] = Element
          return {
            participationId, id, title, createdTime, creatorCardnum, creatorName, projectDesc, skillRequirement, duartion, campus,
            category, otherRequirement, wantedNumber, nowNeedNumber, endTime, auditStatus, qqNum, email, phoneNum
          }
        })
      } else {
        throw '参数不符合规范'
      }

    }
    // 啥都不指定就返回所有通过审核的组队项目，并且没有招满的组队项目
    else {
      let record = await this.db.execute(`
      SELECT * FROM (  
        SELECT T.*,ROWNUM R FROM (
          SELECT *
          FROM H_TEAM_PROJECT
          WHERE AUDITSTATUS = 'PASSED' AND ENDTIME > :now
          ORDER BY CREATEDTIME DESC
      )T)
      WHERE R > :startRow and R <= :endRow
      `, {
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
    }

  }
}