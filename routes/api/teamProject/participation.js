exports.route = {
  // 创建申请信息
  async post({ teamProjectId, major, skill, qqNum, email, phoneNum, desc }) {
    let { cardnum, name } = this.user
    let grade = cardnum.slice(3, 5) + '级'
    let record = await this.db.execute(`
    SELECT CREATORCARDNUM
    FROM H_TEAM_PROJECT
    WHERE ID = :id
    `, { id: teamProjectId })
    if (record.rows.length === 0) {
      throw '项目不存在'
    }
    let creatorCardnum = record.rows[0][0]
    if (!(qqNum && email && phoneNum)) {
      throw '缺少联系方式'
    }
    if (!(major && skill & desc)) {
      throw '内容不完整'
    }
    try {
      await this.db.execute(`
      INSERT INTO H_TEAM_PARTICIPATION
      (CARDNUM, NAME, MAJOR, GRADE, SKILL, QQNUM, EMAIL, PHONENUM, DESCRIPTION, CREATOR, TEAMPROJECTID)
      VALUES (:cardnum, :name, :major, :grade, :skill, :qqNum, :email, :phoneNum, :desc, :creator, :teamProjectId)
      `, {
        cardnum,
        name,
        major,
        grade,
        skill,
        qqNum,
        email,
        phoneNum,
        desc,
        creator: creatorCardnum,
        teamProjectId
      })
    } catch (err) {
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
  async get({ id = '', fromMe, page = 1, pagesize = 10 }) {
    pagesize = +pagesize
    page = +page
    let startRow = (page - 1) * pagesize
    let endRow = page * pagesize
    let { cardnum } = this.user
    // 如果id存在则返回该条目的信息
    if (id) {
      let record = await this.db.execute(`
      SELECT *
      FROM H_TEAM_PARTICIPATION
      WHERE ID = :id
      `, { id })
      return [{ 'isAdmin': true }, record.rows.map(Element => {
        let [id, isAccepted, isRead, cardnum, name, major, grade, skill, qqNum, email, phoneNum, desc, creator, teamProjectId] = Element
        return { id, isAccepted, isRead, cardnum, name, major, grade, skill, qqNum, email, phoneNum, desc, creator, teamProjectId }
      })[0]]
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
      WHERE R > :startRow and R <= endRow
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
      WHERE R > :startRow and R <= endRow
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