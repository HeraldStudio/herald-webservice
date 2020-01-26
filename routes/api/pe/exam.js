
/**
 * 体育理论考试的参考，注意是参考哦！！！
 * 
 * 暂时不使用缓存
 * 
 * 这个网站是怎么得到我也很懵逼，暂且先这样用吧
 */
exports.route = {
  async get() {

    // 暂时固定课程号为 2598，如果日后有更改可以取消注释这一段
    // let res = await this.get('http://tyx.seu.edu.cn')
    // let $ = cheerio.load(res.data)
    // let cid = /course_(\d+)/.exec($('a[title="国家级资源共享课程"]').attr('href'))[1]
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
  }
}