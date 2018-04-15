const { db, Classroom, ClassRecord } = require("./models")

exports.route = {

  /**
  * GET /api/classroom/spare
  * @apiParam pageNo        要查看的查询记录的页数
  * @apiParam pageSize      一页包含的查询记录数目
  * @apiParam campusId?     校区ID，留空则查询所有校区
  * @apiParam buildingId?   教学楼宇ID，留空则查询所有楼宇
  * @apiParam startWeek     一学期中起始周次
  * @apiParam endWeek       一学期中结束周次
  * @apiParam dayOfWeek     查询一星期中的哪一天
  * @apiParam startSequence 一天中起始节次
  * @apiParam endSequence   一天中结束周次
  * @apiParam termId?       查询的学期，留空则查询当前学期
  * @remarks 查询空教室
  * @note
  *   若查询教一~教七则调用学校接口；
  *   对于其他建筑，学校接口暂未提供查询，因而从web service内置数据库中查询。
  **/
  async get({ pageNo, pageSize, campusId, buildingId,
              startWeek, endWeek, dayOfWeek, startSequence, endSequence, termId }) {
    let result = {}

    // 缓存时不针对分页信息，后续查询就不用到数据库里翻
    delete this.params.pageNo
    delete this.params.pageSize

    /*if (this.params.campusID === 22) { // 九龙湖教一~教七
      // 转发请求至学校空教室接口
      result = (await this.post(
        "http://58.192.114.179/classroom/show/getemptyclassroomlist",
        this.querystring
      )).data
    } else { */ // 纪忠楼 & 四牌楼 & 无线谷 & 无锡分校
    // 利用开课列表筛选出当前条件下有课的教室ID
    let spare = await this.publicCache('1d+', async () => {
      // FIXME: 尚未能够处理单双周
      let occupiedClassroomIds = (await db.all(`
        select classroomId from ClassRecord
        where termId = ?
        and   campusId = ifnull(?, campusId)
        and   buildingId = ifnull(?, buildingId)
        and   dayOfWeek = ifnull(?, dayOfWeek)
        and   (startWeek <= ? and endWeek >= ?)
        and   (startSequence <= ? and endSequence >= ?)
      `, [
        termId || ClassRecord.currentTermId(),
        campusId || null,
        buildingId || null,
        dayOfWeek || null,
        endWeek,
        startWeek,
        endSequence,
        startSequence
      ])).map(row => row.classroomId)

      // 筛选出所有无课的教室
      let spareClassrooms = await Promise.all((await db.all(`
        select * from Classroom
        where buildingId = ifnull(?, buildingId)
        and   id not in(${occupiedClassroomIds.toString()})
      `, [
        this.params.buildingId || null,
      ])).map(c => new Classroom(c).load())) // 利用Classroom类剔除多余属性，统一返回的JSON格式

      if (campusId) { // 对校区过滤
        let id = parseInt(campusId)
        spareClassrooms = spareClassrooms.filter(k => k.building.campusId === id)
      }
      return spareClassrooms
    }) // publicCache

    // 分页
    return {
      "pager.pageNo": pageNo,
      "pager.totalRows": spare.length,
      "rows": spare.slice(pageSize * (pageNo - 1), pageSize * pageNo)
    }
  }
}
