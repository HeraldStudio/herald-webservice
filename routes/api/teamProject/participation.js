exports.route = {
  // 创建申请信息
  async post({ teamProjectId, major, skill, qqNum, email, phoneNum, description }) {
    let { cardnum, name } = this.user
    let grade = cardnum.slice(3, 5) + '级'
    let record = await this.db.execute(`
    SELECT CREATORCARDNUM, ID, TITLE
    FROM H_TEAM_PROJECT
    WHERE ID = :id AND ENDTIME > :now AND AUDITSTATUS = 'PASSED'
    `, {
      id: teamProjectId,
      now: +moment()
    })
    if (record.rows.length === 0) {
      throw '项目不存在或未通过审核'
    }
    let creatorCardnum = record.rows[0][0]
    let teamProjectTitle = record.rows[0][2]
    if (creatorCardnum === this.user.cardnum) {
      throw '搞事情？自己申请自己？'
    }
    if (!(qqNum || email || phoneNum)) {
      throw '缺少联系方式'
    }
    if (!(major && skill && description)) {
      throw '内容不完整'
    }
    try {
      await this.db.execute(`
      INSERT INTO H_TEAM_PARTICIPATION
      (CARDNUM, NAME, MAJOR, GRADE, SKILL, QQNUM, EMAIL, PHONENUM, DESCRIPTION, CREATOR, TEAMPROJECTID, TITLE)
      VALUES (:cardnum, :name, :major, :grade, :skill, :qqNum, :email, :phoneNum, :description, :creator, :teamProjectId, :teamProjectTitle)
      `, {
        cardnum,
        name,
        major,
        grade,
        skill,
        qqNum: qqNum ? qqNum : null,
        email: email ? email : null,
        phoneNum: phoneNum ? phoneNum : null,
        description,
        creator: creatorCardnum,
        teamProjectId,
        teamProjectTitle
      })
    } catch (err) {
      console.log(err)
      throw '组队申请提交失败'
    }
    return '组队申请提交成功'
  },
  // 删除申请信息
  async delete({ id }) {
    let { cardnum } = this.user
    let record = await this.db.execute(`
    SELECT CARDNUM
    FROM H_TEAM_PARTICIPATION
    WHERE ID = :id
    `, { id })
    if (record.rows.length === 0) {
      throw '申请信息不存在'
    }

    if (!(record.rows[0][0] === cardnum || await this.hasPermission('teamproject'))) {
      throw '权限不允许'
    }
    try {
      await this.db.execute(`
      DELETE FROM H_TEAM_PARTICIPATION
      WHERE ID = :id
    `, { id })
    } catch (err) {
      throw '组队申请删除失败'
    }
    return '组队申请删除成功'
  },
  async get({ teamProjectId = '', fromMe, page = 1, pagesize = 10 }) {
    pagesize = +pagesize
    page = +page
    let startRow = (page - 1) * pagesize
    let endRow = page * pagesize
    let { cardnum } = this.user
    // 如果id存在则返回该条目的信息
    if (teamProjectId) {
      let record = await this.db.execute(`
      SELECT *
      FROM H_TEAM_PROJECT
      WHERE ID =:id
      `, {
        id: teamProjectId
      })
      if (record.rows.length === 0) {
        throw '条目不存在'
      }
      // 如果是自己发布的
      if (record.rows[0][3] === this.user.cardnum) {
        let participation = await this.db.execute(`
        SELECT *
        FROM H_TEAM_PARTICIPATION
        WHERE TEAMPROJECTID = :teamProjectId
        `, { teamProjectId })
        if (participation.rows.length !== 0) {
          return {
            isCreater: true, participation: participation.rows.map(Element => {
              let [id, isAccepted, isRead, cardnum, name, major, grade, skill, qqNum, email, phoneNum, desc, creator, teamProjectId] = Element
              return { id, isAccepted, isRead, cardnum, name, major, grade, skill, qqNum, email, phoneNum, desc, creator, teamProjectId }
            })
          }
        } else {
          return {
            isCreater: true, participation: []
          }
        }
      } else {
        let participation = await this.db.execute(`
        SELECT *
        FROM H_TEAM_PARTICIPATION
        WHERE TEAMPROJECTID = :teamProjectId AND CARDNUM = :cardnum
        `, {
          teamProjectId,
          cardnum
        })
        if (participation.rows.length !== 0) {
          return {
            isCreater: false, participation: participation.rows.map(Element => {
              let [id, isAccepted, isRead, cardnum, name, major, grade, skill, qqNum, email, phoneNum, desc, creator, teamProjectId] = Element
              return { id, isAccepted, isRead, cardnum, name, major, grade, skill, qqNum, email, phoneNum, desc, creator, teamProjectId }
            })
          }
        } else {
          return {
            isCreater: false, participation: []
          }
        }
      }
    }
    // 查看本人的申请
    else if (fromMe) {
      let record = await this.db.execute(`
      SELECT * FROM (  
        SELECT T.*,ROWNUM R FROM (
          SELECT *
          FROM H_TEAM_PARTICIPATION
          WHERE CARDNUM = :cardnum
      )T)
      WHERE R > :startRow and R <= :endRow
      `, {
        cardnum,
        startRow,
        endRow
      })
      return record.rows.map(Element => {
        let [id, isAccepted, isRead, cardnum, name, major, grade, skill, qqNum, email, phoneNum, desc, creator, teamProjectId] = Element
        return { id, isAccepted, isRead, cardnum, name, major, grade, skill, qqNum, email, phoneNum, desc, creator, teamProjectId }
      })
    }
    // 查看本人收到的申请信息
    else {
      let record = await this.db.execute(`
      SELECT * FROM (  
        SELECT T.*,ROWNUM R FROM (
          SELECT *
          FROM H_TEAM_PARTICIPATION
          WHERE CREATOR = :cardnum
      )T)
      WHERE R > :startRow and R <= :endRow
      `, {
        cardnum,
        startRow,
        endRow
      })
      return record.rows.map(Element => {
        let [id, isAccepted, isRead, cardnum, name, major, grade, skill, qqNum, email, phoneNum, desc, creator, teamProjectId] = Element
        return { id, isAccepted, isRead, cardnum, name, major, grade, skill, qqNum, email, phoneNum, desc, creator, teamProjectId }
      })
    }
  }
}