const cheerio = require('cheerio')

exports.route = {
  async get() {
    return await this.userCache('1mo', async () => {
      let res = await this.get('http://www.icourses.cn/web/sword/portal/testPaper?cid=2598&tid=96af3d8115af4018b0597204d3afda05')
      let $ = cheerio.load(res.data)
      let resources = $('a[data-type="pdf"]').toArray().map(k => $(k)).map(k => ({
        [k.attr('data-title')]: k.attr('data-url')
      })).reduce((a, b) => Object.assign(a, b), {})

      resources['基础课'] = resources['引导课']
      delete resources['引导课']

      let { schoolnum } = this.user
      res = await this.get(`http://xk.urp.seu.edu.cn/jw_service/service/stuCurriculum.action?queryStudentId=${ schoolnum }`)
      let course = Object.keys(resources).find(k => ~res.data.indexOf(k))
      if (course) {
        return { course, url: resources[course] }
      } else {
        throw 404
      }
    })
  }
}