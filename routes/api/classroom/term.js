exports.route = {
  // 获取所有的可以查询的学期
  async get() {
    return await this.publicCache('1mo', async () => {
      let now = +moment()
      let rawData = await this.get(`http://58.192.114.179/classroom/common/gettermlistex?_=${now}`)
      return JSON.parse(rawData.data.toString())
    })
  }
}