exports.campuses = {
  "九龙湖": 22,
  "九龙湖纪忠楼": 23,
  "四牌楼": 24
}

exports.undergrad = async () => await this.axios.post(
  "http://58.192.114.179/classroom/show/getemptyclassroomlist",
  this.querystring
)

exports.postgrad = async function () {
  let records = require("./records.json");
  
}