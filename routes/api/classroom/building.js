const campusMap = {
  '九龙湖': '22',
  '22': '22',
  '1': '22'
}
/**
 * @apiDefine classroom 教室接口
 */
exports.route = {
  /**
  * @api {GET} /api/classroom/building 获取所有的可以查询的教室
  * @apiGroup classroom
  * 
  * @apiParam {String} campus 
  */
  async get({ campus }) {
    return await this.publicCache('1h+', async () => {
      let now = +moment()
      let rawData = await this.get(`http://58.192.114.179/classroom/common/getenabledbuildinglistex?campusId=${campusMap[campus]}&_=${now}`)
      return JSON.parse(rawData.data.toString())
    })
  }
}