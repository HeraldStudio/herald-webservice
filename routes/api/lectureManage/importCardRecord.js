exports.route = {
  /**
  * @api {POST} /api/lectureManage/importCardRecord 新建讲座
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
  }
}