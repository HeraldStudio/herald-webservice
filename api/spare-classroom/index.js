const classroomQuery = require("./query");

exports.route = {

   /**
   * GET /api/spare-classrom
   * @apiParam pageNo        要查看的查询记录的页数
   * @apiParam pageSize      一页包含的查询记录数目
   * @apiParam campusId?     校区ID，留空则查询所有校区
   * @apiParam buildingId?   教学楼宇ID，留空则查询所有楼宇
   * @apiParam startWeek     一学期中起始周次
   * @apiParam endWeek       一学期中结束周次
   * @apiParam dayOfWeek     查询一星期中的哪一天
   * @apiParam startSequence 一天中起始节次
   * @apiParam endSequence   一天中结束周次
   * @apiParam termId        查询的学期
   * @remarks 查询空教室
   * @note 若查询教一~教七则调用学校接口，其余则通过服务器自己获取课表信息后计算而得。
   **/
  async get() {
    //let entries = Object.keys(this.query).map((key, index) => key + "=" + Object.values(this.query)[index]);
    //let formData = entries.reduce((pre, cur) => pre += "&" + cur);

    let result = null;
    if (classroomQuery.hasSchoolInterface(this)) { // 教一~教七
      result = (await classroomQuery.querySchoolInterface(this));
    } else { // 纪忠楼 & 四牌楼 & 无线谷 & 无锡分校
      result = (await classroomQuery.queryServiceDatabase(this));
    }

    return result;
  }
}
