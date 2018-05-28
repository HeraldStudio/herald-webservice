const cheerio = require('cheerio')

exports.route = {
  async get() {
    return await this.publicCache('1mo', async () => {
      // 暂时固定课程号为 2598，如果日后有更改可以取消注释这一段
      // let res = await this.get('http://tyx.seu.edu.cn')
      // let $ = cheerio.load(res.data)
      // let cid = /course_(\d+)/.exec($('a[title="国家级资源共享课程"]').attr('href'))[1]
      
      let cid = 2598
      res = await this.get(`http://mobile.icourses.cn/hep-mobile/sword/app/share/detail/getExam?courseId=${cid}&subjectType=1`)
      return res.data.data.map(k => k.resList[0]).map(k => ({
        title: k.title,
        url: k.fullResUrl
      })).filter(k => k.title !== '身体素质')
    })
  }
}