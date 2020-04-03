exports.route = {
  /**
  * @api {GET} /api/classroom/campus 获取所有的可以查询的校区
  * @apiGroup classroom
  */
  async get() {
    return await this.publicCache('1d+', async () => {
      let now = +moment()
      let rawData = await this.get(`http://58.192.114.179/classroom/common/getenabledcampuslistex?_=${now}`)
      return JSON.parse(rawData.data.toString())
    })
  }
}
