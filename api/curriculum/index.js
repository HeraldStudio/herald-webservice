const cheerio = require('cheerio')

exports.route = {

  /**
   * GET /api/curriculum
   * @apiParam cardnum  一卡通号
   * @apiParam term     学期号
   **/
  async get() {
    let cardnum = this.query.cardnum
    let term = this.query.term
    this.assert(cardnum, 400)

    let isStudent = (/^2/.exec(cardnum))
    
    // 抓取课表页面
    let res = await (isStudent ? this.axios.post(
        'http://xk.urp.seu.edu.cn/jw_service/service/stuCurriculum.action',
      `queryStudentId=${cardnum}` + (term ? `&queryAcademicYear=${term}` : '')
    ) : this.axios.post( // 老师课表
        'http://xk.urp.seu.edu.cn/jw_service/service/teacurriculum.action',
        `query_teacherId=${cardnum}` + (term ? `&query_xnxq=${term}` : '')
    ))

    // 从课表页面抓取学期号
    term = /<font class="Context_title">[\s\S]*?(\d{2}-\d{2}-\d)[\s\S]*?<\/font>/im.exec(res.data)[1]

    // 抓取学期详情列表
    let termRes = await this.axios.get('http://58.192.114.179/classroom/common/gettermlistex')

    // 学期详情中的格式为 2017-2018-2 的形式，取年份后两位进行匹配，匹配到的学期详情留下
    term = termRes.data.filter(k => {
      let found = /^..(..-)..(..-.*)$/.exec(k.code)
      return found && found.slice(1).join('') === term
    })[0]

    if (term) {
      term = {
        code: term.code,
        startDate: term.startDate.time,
        endDate: term.endDate.time,
        startWeek: term.startWeek,
        endWeek: term.endWeek
      }
    }

    // 从课表页面抓取身份信息
    let [collegeId, collegeName] = isStudent ? /院系:\[(\d*)](.*?)</im.exec(res.data).slice(1, 3) : ['', /院系:(.*?)</im.exec(res.data)[1]]
    let [majorId, majorName] = isStudent ? /专业:\[(\d*)](.*?)</im.exec(res.data).slice(1, 3) : ['','']
    let schoolnum = isStudent ? /学号:(\d*)/im.exec(res.data)[1] : ''
    if (isStudent) {
        cardnum = /一卡通号:(\d*)/im.exec(res.data)[1]
    }
    let name = isStudent ? /姓名:([^<]*)/im.exec(res.data)[1] : /系 ([^<]*)课表/im.exec(res.data)[1]
    let user = { cardnum, schoolnum, name, collegeId, collegeName, majorId, majorName }

    // 初始化侧边栏和课表解析结果
    let sidebar = {}, curriculum = {};

    // 解析侧边栏，先搜索侧边栏所在的 table
    res.data.match(/class="tableline">([\s\S]*?)<\/table/img)[0]

      // 取 table 中所有行
      .match(/<tr height="3[48]">[\s\S]*?<\/tr\s*>/img) // 老师课表是height=38

      // 去掉表头表尾
      .slice(1, -1).map(k => {

        // 取每行中所有五个单元格，去掉第一格，分别抽取文本并赋给课程名、教师名、学分、周次
        let courseData = k.match(/<td[^>]*>(.*?)<\/td\s*>/img)
        if (isStudent) {
          courseData = courseData.slice(1)
        } else {
          courseData = [courseData[1],courseData[3],courseData[7],courseData[9]]
        }
        let [className, teacherName, score, weeks] = courseData.map(td => cheerio.load(td).text().trim())

        // 表格中有空行，忽略空行，将非空行的值加入哈希表进行索引，以课程名+周次为索引条件
        if (className || weeks) {
          sidebar[className.trim() + '/' + weeks] = { className, teacherName, score, weeks }
        }
      })

    // 初始化周一至周日每天的课程列表
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    days.forEach(k => curriculum[k] = [])

    // 方法复用，传入某个单元格的 html 内容（td 标签可有可无），将单元格中课程进行解析并放入对应星期的课程列表中
    function appendClasses(cellContent, dayIndex) {

      // 流式编程高能警告
      curriculum[days[dayIndex]] = curriculum[days[dayIndex]].concat(

        // 在单元格内容中搜索连续的三行，使得这三行中的中间一行是 [X-X周]X-X节 的格式，对于所有搜索结果
        // 老师课表多出来一个空行
        (cellContent.match(/[^<>]*<br>(?:<br>)?\[\d+-\d+周]\d+-\d+节<br>[^<>]*/img) || []).map(k => {

          // 在搜索结果中分别匹配课程名、起止周次、起止节数、单双周、上课地点
          let [className, beginWeek, endWeek, beginPeriod, endPeriod, flip, location]
            = /([^<>]*)<br>(?:<br>)?\[(\d+)-(\d+)周](\d+)-(\d+)节<br>(\([单双]\))?([^<>]*)/.exec(k).slice(1);

          // 对于起止周次、起止节数，转化成整数
          [beginWeek, endWeek, beginPeriod, endPeriod] = [beginWeek, endWeek, beginPeriod, endPeriod].map(k => parseInt(k))

          // 对于单双周，转换成标准键值
          flip = {'(单)': 'odd', '(双)': 'even'}[flip] || 'none'

          // 根据课程名和起止周次，拼接索引键，在侧栏表中查找对应的课程信息
          let key = className.trim() + '/' + beginWeek + '-' + endWeek
          let teacherName = '', score = ''

          // 若在侧栏中找到该课程信息，取其教师名和学分数，并标记该侧栏课程已经使用
          if (sidebar.hasOwnProperty(key)) {
            teacherName = sidebar[key].teacherName
            score = sidebar[key].score
            sidebar[key].used = true
          }

          // 返回课程名，教师名，学分，上课地点，起止周次，起止节数，单双周，交给 concat 拼接给对应星期的课程列表
          return { className, teacherName, score, location, beginWeek, endWeek, beginPeriod, endPeriod, flip }
        })
      )
    }

    // 对于第二个大表格
    res.data.match(/class="tableline"\s*>([\s\S]*?)<\/table/img)[1]

      // 取出每一行最末尾的五个单元格，排除第一行
      .match(/(<td[^>]*>.*?<\/td>[^<]*){5}<\/tr/img).slice(1).map(k => {

        // 对于每行每个单元格中的内容，利用 map 的双参数用法，把五列内容分别交给周一到周五
        k.match(/<td[^>]*>.*?<\/td>/img).map(appendClasses)
      });

    // 取周六大单元格的内容，交给周六
    appendClasses(/>周六<\/td>[^<]*<td[^>]*>([\s\S]*?)<\/td>/img.exec(res.data)[1], 5)

    // 取周日大单元格的内容，交给周日
    appendClasses(/>周日<\/td>[^<]*<td[^>]*>([\s\S]*?)<\/td>/img.exec(res.data)[1], 6)

    // 将侧栏中没有用过的剩余课程（浮动课程）放到 other 字段里
    curriculum.other = Object.values(sidebar).filter(k => !k.used)

    // 缓存1天
    this.state.ttl = 60 * 60 * 24
    return { term, user, curriculum }
  }
}
