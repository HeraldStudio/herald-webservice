const classroomQuery = require("./query");

exports.route = {

   /**
   * GET /api/spare-classrom
   * @apiParam cardnum  一卡通号
   * @apiParam password 统一身份认证密码
   **/
  async get() {
    let entries = Object.keys(this.query).map((key, index) => key + "=" + Object.values(this.query)[index]);
    let formData = entries.reduce((pre, cur) => pre += "&" + cur);
    let result = null;

    if (this.query.campusId == classroomQuery.campuses.九龙湖本科) { // 教一~教七
      result = classroomQuery.undergrad.call(this).data;
    } else { // 纪忠楼 & 四牌楼
      result = classroomQuery.postgrad.call(this).data;
    }

    return result;
  }
}
