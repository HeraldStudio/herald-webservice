exports.route = {
  /**
  * @api {GET} /api/lecture/admin/cardRecord 查询讲座打卡纪录
  * @apiGroup lecture
  * @apiParam {String} lectureID 讲座ID
  * @returns [{id, cardnum, name, location, timestamp}]
  */
  async get({lectureID}) {
    // if (!(await this.hasPermission('lecturerecord'))) {
    //   throw 403
    // }
    if (!lectureID) {
      throw '参数不全'
    }
    // 查找此讲座的打卡记录
    let rawResult = await this.db.execute(`
      SELECT ID, CARDNUM, NAME, LOCATION, DATESTR, TIMESTAMP
      FROM H_LECTURE_CARDRECORD 
      WHERE LECTURE_ID = :lectureID AND DELETED = 0
      ORDER BY TIMESTAMP
    `, {
      lectureID
    })
    let result = []
    rawResult.rows.forEach(r => {
      result.push({
        id: r[0],
        cardnum: r[1],
        name: r[2],
        location: r[3],
        timestamp: r[5]
      })
    })
    return result
  },
  /**
  * @api {POST} /api/lectureManage/cardRecord 新建讲座打卡记录
  * @apiGroup lecture
  * 
  * @apiParam {Array} recordArray 打卡记录
  *   @apiParam {String} cardnum 打卡的一卡通号
  *   @apiParam {String} location 打卡位置
  *   @apiParam {String} name 打卡姓名
  *   @apiParam {String} dateStr 打卡日期 YYYY-MM-DD 格式
  *   @apiParam {Number} timestamp 时间戳
  * @apiParam {String} lectureID 讲座ID
  */
  async post({recordArray, lectureID}) {
    if (!(await this.hasPermission('lecturerecord'))) {
      throw 403
    }
    let sql = `
      INSERT INTO H_LECTURE_CARDRECORD
      (CARDNUM, LOCATION, NAME, DATESTR, TIMESTAMP, LECTURE_ID)
      VALUES (:1, :2, :3, :4, :5, :6)`
    let content = recordArray.map(curRecord => {
      const {cardnum, location, name, dateStr, timestamp} = curRecord
      return [cardnum, location, name, dateStr, timestamp, lectureID]
    })
    try {
      await this.db.executeMany(sql, content)
    } catch (e) {
      if (e.errorNum === 1400) {
        throw '参数不全'
      }
      throw '内部错误'
    }
    return '添加成功'
  },
  /**
  * @api {DELETE} /api/lecture/admin/cardRecord 删除打卡纪录
  * @apiGroup lecture
  * @apiParam {String} id 打卡记录ID
  */
  async delete({id, all, lectureID, byDate, beginTime, endTime}) {
    if (!(await this.hasPermission('lecturerecord'))) {
      throw 403
    }

    if (all === 'true') {
      await this.db.execute(`
        UPDATE H_LECTURE_CARDRECORD
        SET DELETED = 1
        WHERE LECTURE_ID = :lectureID
      `, {
        lectureID
      })
      return '删除成功'
    }

    if (byDate === 'true') {
      await this.db.execute(`
        UPDATE H_LECTURE_CARDRECORD
        SET DELETED = 1
        WHERE LECTURE_ID = :lectureID AND TIMESTAMP >= :beginTime AND TIMESTAMP <= :endTime
      `, {
        lectureID, beginTime, endTime
      })
      return '删除成功'
    }

    if (!id)
      throw "未提供ID"

    await this.db.execute(`
      UPDATE H_LECTURE_CARDRECORD
      SET DELETED = 1
      WHERE ID = :id
    `, {id})
    return '删除成功'
  }
}