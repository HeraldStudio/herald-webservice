const cheerio = require('cheerio')
const loginUrl = 'http://phylab.seu.edu.cn/plms/UserLogin.aspx?ReturnUrl=%2fplms%2fSelectLabSys%2fDefault.aspx'
const courseUrl = 'http://phylab.seu.edu.cn/plms/SelectLabSys/StuViewCourse.aspx'
const { config } = require('../../app')

const headers = {
  'Cache-Control': 'no-cache',
  'Origin': 'http://phylab.seu.edu.cn',
  'X-MicrosoftAjax': 'Delta=true',
  'Cookie': '',
  'User-Agent': 'Mozilla/5.0 (Windows NT 6.2; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/40.0.2214.115 Safari/537.36',
  'Content-Type': 'application/x-www-form-urlencoded',
  'Accept': '*/*',
  'Referer': 'http://phylab.seu.edu.cn/plms/Default.aspx',
  'Accept-Encoding': 'gzip, deflate',
  'Accept-Language': 'zh-CN,zh;q=0.8,en;q=0.6,ja;q=0.4'
}

const generateLoginForm = ($, cardnum, password) => {
  let skeleton = {
    'ctl00$ScriptManager1': 'UpdatePanel3|UserLogin1$btnLogin',
    'ctl00$cphSltMain$UserLogin1$rblUserType': 'Stu',
    'ctl00$cphSltMain$UserLogin1$btnLogin': '登  陆',
    '__ASYNCPOST': 'true'
  }

  $('input[type="hidden"]').toArray().map(k => $(k)).map(k => {
    skeleton[k.attr('name')] = k.attr('value')
  })

  skeleton['ctl00$cphSltMain$UserLogin1$txbUserCodeID'] = cardnum
  skeleton['ctl00$cphSltMain$UserLogin1$txbUserPwd'] = password
  return skeleton
}

const generateQueryForm = ($, typeId) => {
  let skeleton = {
    'ctl00$ScriptManager1': 'ctl00$cphSltMain$UpdatePanel1|ctl00$cphSltMain$ShowAStudentScore1$ucDdlCourseGroup$ddlCgp',
    '__EVENTTARGET': 'ctl00$cphSltMain$ShowAStudentScore1$ucDdlCourseGroup$ddlCgp',
    '__EVENTARGUMENT': '',
    '__LASTFOCUS': '',
    'ctl00$cphSltMain$ShowAStudentScore1$ucDdlCourseScoreType$ddlCourseScoreType': '1',
    '__VIEWSTATEENCRYPTED': '',
    '__ASYNCPOST': 'true'
  }

  $('input[type="hidden"]').toArray().map(k => $(k)).map(k => {
    skeleton[k.attr('name')] = k.attr('value')
  })

  skeleton['ctl00$cphSltMain$ShowAStudentScore1$ucDdlCourseGroup$ddlCgp'] = typeId
  return skeleton
}

exports.route = {

  /**
  * GET /api/phylab
  * 物理实验查询
  *
  * 返回格式举例：
  * [
  *   {
  *     type,        // 类别，例如「基础性实验（上）」
  *     labName,     // 实验名
  *     teacherName, // 教师名
  *     startTime,   // 开始时间戳
  *     endTime,     // 结束时间戳（开始3小时后）
  *     location,    // 地点
  *     score        // 成绩，空串表示暂无成绩
  *   }
  * ]
  **/
  async get() {
    return await this.userCache('1d+', async () => {

      // 先检查可用性，不可用直接抛异常或取缓存
      this.guard('http://phylab.seu.edu.cn/plms/UserLogin.aspx')

      let { cardnum, password } = this.user

      // 先抓一下页面，得到 Cookie 和隐藏值，否则无法登陆
      let res = await this.get(loginUrl, { headers })
      let $ = cheerio.load(res.data)
      let loginForm = generateLoginForm($, cardnum, password)

      res = await this.post(loginUrl, loginForm, { headers })
      res = await this.get(courseUrl, { headers })
      $ = cheerio.load(res.data)

      // 课程组。键是序号，值是名称。
      let types = {}
      $('select[name="ctl00$cphSltMain$ShowAStudentScore1$ucDdlCourseGroup$ddlCgp"] option')
        .toArray().map(k => $(k)).map(k => types[k.attr('value')] = k.text())

      let result = await Promise.all(Object.keys(types).map(async k => {
        let type = types[k]
        let form = generateQueryForm($, k)
        let res = await this.post(courseUrl, form, { headers })
        {
          let $ = cheerio.load(res.data)
          let table = $('table#ctl00_cphSltMain_ShowAStudentScore1_gvStudentCourse')
          let data = $('table#ctl00_cphSltMain_ShowAStudentScore1_gvStudentCourse span')
            .toArray().map(i => $(i).text())
          let labs = []
          while (data.length) {
            let [labName, teacherName, date, time, location, score] = data.splice(0, 6)
            let [y, M, d] = date.split(/[年月日（ (]/g)
            let [h, m] = { '上午': [9, 45], '下午': [13, 45], '晚上': [18, 15] }[time]
            let startMoment = moment([y, M - 1, d, h, m])
            let startTime = +startMoment
            let endTime = +startMoment.add(3, 'hours')
            labs.push({type, labName, teacherName, startTime, endTime, location, score})
          }
          return labs
        }
      }))

      return result.reduce((a, b) => a.concat(b), []).filter(k => k.startTime >= (this.term.current || this.term.prev).startDate)
    })
  }
}
