const { adminList } = require('./admin.json')
const { deleteFile } = require('../../../sdk/qiniu')
const oracledb = require('oracledb')
exports.route = {
  /**
   * GET /api/lostAndFound
   * @param { 
   * id,                            // 返回单一条目 
   * type : lost/found/audit,       // 分别返回失物招领，寻物启事， 待审核条目
   * page, 
   * pagesize } 
   * 获取接口
   * @returns { 
   * result : [{ 
   * _id : String,                  
   * creator : String, 
   * title : String, 
   * lastModifiedTime : 时间戳(ms), 
   * describe : String, 
   * imageUrl : String(最多三张), 
   * type : lost/found, 
   * isAudit : Number, 
   * isFinished : Number
   * }]}
   */
  async get({ id = '', type, page = 1, pagesize = 10 }) {
    let { cardnum } = this.user
    // let lostAndFoundCollection = await mongodb('H_LOST_AND_FOUND')
    if (id) {
      return await this.publicCache('1d+', async () => {
        // 如果存在 id 则返回条目的信息
        let record = await this.db.execute(`
        select * 
        from H_LOST_AND_FOUND
        where wid = '${id}'
        `)
        record = record.rows.map(Element => {
          let [_id, creator, title, lastModifiedTime, describe, imageUrl, type, isAudit, isFinished] = Element
          return { _id, creator, title, lastModifiedTime, describe, imageUrl, type, isAudit, isFinished }
        })[0]
        if (adminList.indexOf(cardnum) !== -1) {
          record.canAudit = true
        }
        // 前端要求，除去值为null的字段
        for (let e in record) {
          if (record[e] === null)
            delete record[e]
        }
        return record
      })
    }
    // 确保分页的数据正确
    page = +page
    pagesize = +pagesize
    if (type === 'lost') {
      // 分页返回所有的失物招领
      let record = await this.db.execute(`
      SELECT * FROM (  
        SELECT ROWNUM R,T.* FROM (
          SELECT * 
          FROM H_LOST_AND_FOUND
          where isAudit = 1 and isFinished = 0 and type = 'lost'
          ORDER BY LASTMODIFIEDTIME DESC
        )T)
      WHERE R > ${(page - 1) * pagesize} and R <= ${page * pagesize}
        `)
      record = record.rows.map(Element => {
        let [_id, creator, title, lastModifiedTime, describe, imageUrl, type, isAudit, isFinished] = Element
        return { _id, creator, title, lastModifiedTime, describe, imageUrl, type, isAudit, isFinished }
      })
      // 前端要求，除去值为null的字段
      record.forEach(Element => {
        for (let e in Element) {
          if (Element[e] === null)
            delete Element[e]
        }
      })
      return record
    } else if (type === 'found') {
      // 分页返回所有的寻物启事
      let record = await this.db.execute(`
      SELECT * FROM (  
        SELECT ROWNUM R,T.* FROM (
          SELECT * 
          FROM H_LOST_AND_FOUND
          where isAudit = 1 and isFinished = 0 and type = 'found'
          ORDER BY LASTMODIFIEDTIME DESC
        )T)
      WHERE R > ${(page - 1) * pagesize} and R <= ${page * pagesize}
      `)
      record = record.rows.map(Element => {
        let [_id, creator, title, lastModifiedTime, describe, imageUrl, type, isAudit, isFinished] = Element
        return { _id, creator, title, lastModifiedTime, describe, imageUrl, type, isAudit, isFinished }
      })
      // 前端要求，除去值为null的字段
      record.forEach(Element => {
        for (let e in Element) {
          if (Element[e] === null)
            delete Element[e]
        }
      })
      return record
    } else if (type === 'audit') {
      // 分页返回所有的待审核事件
      if (adminList.indexOf(cardnum) === -1) {
        // 只允许管理员查看
        return []
      }
      let record = await this.db.execute(`
      SELECT * FROM (  
        SELECT ROWNUM R,T.* FROM (
          SELECT * 
          FROM H_LOST_AND_FOUND
          where isAudit = 0 and isFinished = 0
          ORDER BY LASTMODIFIEDTIME DESC
        )T)
      WHERE R > ${(page - 1) * pagesize} and R <= ${page * pagesize}
      `)
      record = record.rows.map(Element => {
        let [_id, creator, title, lastModifiedTime, describe, imageUrl, type, isAudit, isFinished] = Element
        return { _id, creator, title, lastModifiedTime, describe, imageUrl, type, isAudit, isFinished }
      })
      // 前端要求，除去值为null的字段
      record.forEach(Element => {
        for (let e in Element) {
          if (Element[e] === null)
            delete Element[e]
        }
      })
      return record
    } else {
      // 什么都不指定就返回由自己创建的
      let record = await this.db.execute(`
        SELECT * FROM (  
          SELECT ROWNUM R,T.* FROM (
            SELECT * 
            FROM H_LOST_AND_FOUND
            WHERE CREATOR = '${cardnum}'
            ORDER BY LASTMODIFIEDTIME DESC
          )T)
        WHERE R > ${(page - 1) * pagesize} and R <= ${page * pagesize}
        `)
      record = record.rows.map(Element => {
        let [_id, creator, title, lastModifiedTime, describe, imageUrl, type, isAudit, isFinished] = Element
        return { _id, creator, title, lastModifiedTime, describe, imageUrl, type, isAudit, isFinished }
      })
      // 前端要求，除去值为null的字段
      record.forEach(Element => {
        for (let e in Element) {
          if (Element[e] === null)
            delete Element[e]
        }
      })
      return record
    }
  },
  /**
     * POST /api/lostAndFound
     * @param { type, title, describe, imageUrl } 
     * 新建接口
     */
  async post({ type, title, describe, imageUrl }) {
    let { cardnum } = this.user
    if (['lost', 'found'].indexOf(type) === -1) {
      throw '事务类型不正确'
    }
    if (!title || title.length <= 0) {
      throw '必须指定物品名称'
    }
    if (imageUrl && imageUrl.indexOf(`lf-${cardnum}`) === -1) {
      throw '图片不合法'
    }

    let sql = `INSERT INTO H_LOST_AND_FOUND VALUES (sys_guid(), :1, :2, :3, :4, :5, :6, :7, :8)`

    let binds = [
      [cardnum, title, +moment(), describe ? describe : '', imageUrl ? imageUrl : '', type, 0, 0],
    ]

    let options = {
      autoCommit: true,

      bindDefs: [
        { type: oracledb.STRING, maxSize: 20 },
        { type: oracledb.STRING, maxSize: 100 },
        { type: oracledb.NUMBER },
        { type: oracledb.STRING, maxSize: 1000 },
        { type: oracledb.STRING, maxSize: 1000 },
        { type: oracledb.STRING, maxSize: 20 },
        { type: oracledb.NUMBER },
        { type: oracledb.NUMBER },
      ]
    }

    let result = await this.db.executeMany(sql, binds, options)

    if (result.rowsAffected > 0) {
      return '提交成功'
    } else {
      throw '提交失败'
    }
  },

  async put({ id, title, describe, imageUrl }) {
    let { cardnum } = this.user
    let record = await this.db.execute(`
    select * from H_LOST_AND_FOUND
    where wid='${id}'
  `)
    let oldRecord = record.rows.map(Element => {
      let [_id, creator, title, lastModifiedTime, describe, imageUrl, type, isAudit, isFinished] = Element
      return { _id, creator, title, lastModifiedTime, describe, imageUrl, type, isAudit, isFinished }
    })[0]
    if (imageUrl && imageUrl.indexOf(`lf-${cardnum}`) === -1) {
      throw '图片不合法'
    }
    if (!oldRecord) {
      throw '待修改事务不存在'
    }
    if (oldRecord.isFinished || oldRecord.isAudit) {
      throw '不能修改已审核或者已标记完成的事务'
    }
    // 删除旧的 record 的图片
    if (oldRecord.imageUrl) {
      oldRecord.imageUrl.split('|').forEach(url => deleteFile(url))
    }

    let result = await this.db.execute(`
        UPDATE H_LOST_AND_FOUND
        SET 
        TITLE = :title,
        DESCRIBE = :describe,
        IMAGEURL = ${imageUrl ? `'${imageUrl}'` : null},
        LASTMODIFIEDTIME = ${+moment()}
        WHERE wid = '${id}'
        `, { title: title ? title : oldRecord.title, describe: describe ? describe : oldRecord.describe })

    if (result.rowsAffected > 0) {
      this.clearCache(id)
      return '修改成功'
    } else {
      throw '修改失败'
    }
  },

  async delete({ id }) {
    let { cardnum } = this.user
    let record = await this.db.execute(`
    select * from H_LOST_AND_FOUND
    where wid='${id}'
  `)
    record = record.rows.map(Element => {
      let [_id, creator, title, lastModifiedTime, describe, imageUrl, type, isAudit, isFinished] = Element
      return { _id, creator, title, lastModifiedTime, describe, imageUrl, type, isAudit, isFinished }
    })[0]
    // 管理员可以删除所有
    if ([record.creator, ...adminList].indexOf(cardnum) === -1) {
      throw 401
    }
    if (!record) {
      throw '事务不存在'
    }
    if (record.imageUrl) {
      record.imageUrl.split('|').forEach(url => deleteFile(url))
    }

    let result = await this.db.execute(`
    DELETE from H_LOST_AND_FOUND
    WHERE WID ='${id}'
  `)
    if (result.rowsAffected > 0) {
      this.clearCache(id)
      return '删除成功'
    } else {
      throw '删除失败'
    }
  }
}