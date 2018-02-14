const cheerio = require('cheerio')
const loginUrl = 'http://phylab.seu.edu.cn/plms/UserLogin.aspx?ReturnUrl=%2fplms%2fSelectLabSys%2fDefault.aspx'
const courseUrl = 'http://phylab.seu.edu.cn/plms/SelectLabSys/StuViewCourse.aspx'
const courseGroupSelName = 'ctl00$cphSltMain$ShowAStudentScore1$ucDdlCourseGroup$ddlCgp'
const scoreTypeSelName = 'ctl00$cphSltMain$ShowAStudentScore1$ucDdlCourseScoreType$ddlCourseScoreType'


exports.route = {

  /**
   * GET /api/phylab
   * 物理实验查询
   **/
  async get() {
    function getForm($) {
      let form = {}
      $('input').map((n, item) => {
        let i = $(item)
        form[i.attr('name')] = i.attr('value')
      })
      return form
    }
    // 要单独登陆，需要知道 card 和密码
    let { cardnum, password } = this.user
    // 先抓一下页面，得到 Cookie 和隐藏值，否则无法登陆
    let firstRes = await this.get(loginUrl)
    let $ = cheerio.load(firstRes.data)
    // 把 input 的内容都扔到 form 里
    let loginForm = getForm($)
    // 修改几个信息
    // 登陆类型设为学生
    loginForm['ctl00$cphSltMain$UserLogin1$rblUserType'] = 'Stu'
    loginForm['ctl00$cphSltMain$UserLogin1$txbUserCodeID'] = cardnum
    loginForm['ctl00$cphSltMain$UserLogin1$txbUserPwd'] = password
    // 然后 post 一下就登进去了
    let res = await this.post(loginUrl, loginForm)
    // TODO: 我现在没有实验可供查看，所以不知道接下来该怎么弄
    firstRes = await this.get(courseUrl)
    $ = cheerio.load(firstRes.data)
    let courseForm = getForm($)
    // 课程组。键是序号，值是名称。
    let groups = {}
    $(`select[name="${courseGroupSelName}"] option`)
      .toArray()
      .map(i => $(i))
      .map(i => groups[i.attr('value')] = i.text)
    courseForm[scoreTypeSelName] = 1 // "单实验总分"
    let courses = {}
    // 一组一组获取
    /*await Object.keys(groups).forEach(async function (k) {
      courseForm[courseGroupSelName] = k
      let res = await this.post(courseUrl, courseForm)
      let $ = cheerio.load(res.data)
      // 以下来自 ws2。目前我无法对其正确性进行测试。
      let table = $('table#ctl00_cphSltMain_ShowAStudentScore1_gvStudentCourse')
      let data = $('table#ctl00_cphSltMain_ShowAStudentScore1_gvStudentCourse span').toArray().map(i => $(i).text)
      if (!data.length) {
        return
      }
      // 六个一组
      while (data.length) {
        let thisCourse = data.splice(0, 6)
        let cur = { group: groups[k] }
        ;['name', 'teacher', 'date',
          'day', 'address', 'grade']
            .forEach((k, i) => {
              cur[k] = thisCourse[i]
            })
        courses.push(cur)
      }
    }, this)
    return courses*/
  }
}
