
/**
 * 体育理论考试的参考，注意是参考哦！！！
 * 
 * 暂时不使用缓存
 * 
 * 这个网站是怎么得到我也很懵逼，暂且先这样用吧
 */
exports.route = {
  async get() {
    return await this.publicCache('1d', async() => {
      let cid = 2598
      let res = await this.get(`http://mobile.icourses.cn/hep-mobile/sword/app/share/detail/getExam?courseId=${cid}&subjectType=1`)
      // buffer 转为JSON
      res = JSON.parse(res.data.toString()).data
      // 获取真正的数据
      res = res.map( k => k.resList[0]).map( k => ({
        title: k.title,
        url: k.fullResUrl
      }))
      return res
    })
  }
}