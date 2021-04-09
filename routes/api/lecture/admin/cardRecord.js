exports.route = {
  /**
  * @api {GET} /api/lectureManage/cardRecord 查询讲座打卡纪录
  * @apiGroup lecture
  * @param lectureID 讲座ID
  * @returns [{id, cardnum, name, location, timestamp}]
  */

  async get({lectureID}) {
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
  * @apiGroup lectureManage
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
    for (let curRecord of recordArray) {
      const {cardnum, location, name, dateStr, timestamp} = curRecord
      await this.db.execute(`
        INSERT INTO H_LECTURE_CARDRECORD
        (CARDNUM, LOCATION, NAME, DATESTR, TIMESTAMP)
        VALUES (:cardnum, :location, :name, :dateStr, :timestamp)`,{
        cardnum, location, name, dateStr, timestamp
      })
    }
    return '添加成功'
  },
  async delete({id}) {
    await this.db.execute(`
      DELETE FROM H_LECTURE_CARDRECORD
      WHERE ID = :id
    `, {id})
    return '删除成功'
  }
}