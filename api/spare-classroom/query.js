exports.isUndergrad() = function() {

}

exports.undergrad = async () => await this.axios.post(
  "http://58.192.114.179/classroom/show/getemptyclassroomlist",
  this.querystring
)

exports.postgrad = async function () {
  let records = require("./records.json");
  
}