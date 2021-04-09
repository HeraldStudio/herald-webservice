exports.route = {
  /**
  * @api {GET} /api/lecture/admin/cardRecord 查询讲座打卡纪录
  * @apiGroup lecture
  * @apiParam {String} lectureID 讲座ID
  * @returns [{id, cardnum, name, location, timestamp}]
  */
  async get({lectureID}) {
    if (!(await this.hasPermission('lecturerecord'))) {
      throw 403
    }
    if (!lectureID) {
      throw '参数不全'
    }
    let lectureResult = await this.db.execute(`
      SELECT NAME, DATESTR, LOCATION
      FROM H_LECTURE_HISTORY
      WHERE ID = :lectureID
    `, {lectureID})
    let lectureMap = {}
    lectureMap[lectureResult.rows[0][1]] = {}
    lectureMap[lectureResult.rows[0][1]][lectureResult.rows[0][2]] = [{
      name: lectureResult.rows[0][0],
      dateStr: lectureResult.rows[0][1],
      location: lectureResult.rows[0][2]
    }]
    // 查找当天的打卡记录
    let rawResult = await this.db.execute(`
      SELECT ID, CARDNUM, NAME, LOCATION, DATESTR, TIMESTAMP
      FROM H_LECTURE_CARDRECORD 
      WHERE DATESTR = :dateStr AND LOCATION = :location
      ORDER BY TIMESTAMP
    `, {
      dateStr: lectureResult.rows[0][1],
      location: lectureResult.rows[0][2]
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
  * @api {POST} /api/lectureManage/cardRecord 新建讲座
  * @apiGroup lecture
  * 
  * @apiParam {Array} recordArray 打卡记录
  * @apiParam {String} cardnum 打卡的一卡通号
  * @apiParam {String} location 打卡位置
  * @apiParam {String} name 打卡姓名
  * @apiParam {String} dateStr 打卡日期 YYYY-MM-DD 格式
  * @apiParam {Number} timestamp 时间戳
  */
  async post({recordArray}) {
    if (!(await this.hasPermission('lecturerecord'))) {
      throw 403
    }
    let sql = `
      INSERT INTO H_LECTURE_CARDRECORD
      (CARDNUM, LOCATION, NAME, DATESTR, TIMESTAMP)
      VALUES (:1, :2, :3, :4, :5)`
    let content = recordArray.map(curRecord => {
      const {cardnum, location, name, dateStr, timestamp} = curRecord
      return [cardnum, location, name, dateStr, timestamp]
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
  async delete({id}) {
    if (!(await this.hasPermission('lecturerecord'))) {
      throw 403
    }
    await this.db.execute(`
      DELETE FROM H_LECTURE_CARDRECORD
      WHERE ID = :id
    `, {id})
    return '删除成功'
  }
}