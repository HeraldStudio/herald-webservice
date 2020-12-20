exports.route = {
  async post() {
    
    const url = `http://srtp.seu.edu.cn/seu_back/Home/Cas?ticket=${ticket}`
    try {
      let res = await this.get(url)

      // let res = await this.post(`http://srtp.seu.edu.cn/seu_back/api/services/app/PointsQuery/GetStudentScoreInfos`, { id: "60491" })
      console.log(res)
      console.log(this.cookieJar)
    } catch (err) {
      console.log(err)
    }


  }
}