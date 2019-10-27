const campusMap = {
  '九龙湖':'22',
  '22':'22',
  '1':'22'
}
exports.route = {
  // 获取所有的可以查询的教室
  async get ({campus}) {
    let now = +moment()
    let rawData = await this.get(`http://58.192.114.179/classroom/common/getenabledbuildinglistex?campusId=${campusMap[campus]}&_=${now}`)
    return rawData.data
  }
}