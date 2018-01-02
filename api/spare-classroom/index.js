const FormData = require('form-data');


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

    if (this.query.campusId == "22") { // 教一~教七
      result = (await this.axios.post(
        "http://58.192.114.179/classroom/show/getemptyclassroomlist",
        formData
        )).data;
    } else { // 纪忠楼 & 四牌楼

    }

    return result;
  }
}