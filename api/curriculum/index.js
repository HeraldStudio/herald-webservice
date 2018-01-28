const cheerio = require('cheerio')

exports.route = {

  /**
   * GET /api/curriculum
   * @apiParam cardnum  一卡通号
   * @apiParam term     学期号
   **/
  async get() {
    let term = this.query.term
    let { cardnum } = this

    // 老师的号码是1开头的九位数
    // 考虑到学号是八位数的情况
    let isStudent = !(/^1\d{8}$/.exec(cardnum))

    // 抓取课表页面
    let res = await (isStudent ? this.post(
        'http://xk.urp.seu.edu.cn/jw_service/service/stuCurriculum.action',
      `queryStudentId=${cardnum}` + (term ? `&queryAcademicYear=${term}` : '')
    ) : this.post( // 老师课表
        'http://xk.urp.seu.edu.cn/jw_service/service/teacurriculum.action',
        `query_teacherId=${cardnum}` + (term ? `&query_xnxq=${term}` : '')
    ))

    try {
      // 从课表页面抓取学期号
      term = /<font class="Context_title">[\s\S]*?(\d{2}-\d{2}-\d)[\s\S]*?<\/font>/im.exec(res.data)[1]
    } catch (e) {
      this.throw(404)
      return
    }

    // 抓取学期详情列表
    let termRes = await this.get('http://58.192.114.179/classroom/common/gettermlistex')

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
    let [collegeId, collegeName] = isStudent ?
        (/院系:\[(\d*)](.*?)</im.exec(res.data).slice(1, 3)) :
        [/(\d+)系 [^<]*课表/.exec(res.data)[1], /院系:(.*?)</im.exec(res.data)[1]]
    // FIXME 这里学生的学院编号似乎和老师的格式是不一样的
    // 不知道会有什么问题。

    // 看上去老师并没有专业
    let [majorId, majorName] = isStudent ?
        (/专业:\[([0-9A-Z]*)](.*?)</im.exec(res.data).slice(1, 3)) :
        ['','']
    // 对于老师，这个页面也没有显示学号，大约是没有的吧
    let schoolnum = isStudent ? (/学号:([0-9A-Z]*)/im.exec(res.data)[1]) : ''
    if (isStudent) {
        cardnum = /一卡通号:(\d*)/im.exec(res.data)[1]
    }
    let name = isStudent ?
        (/姓名:([^<]*)/im.exec(res.data)[1]) :
        /系 ([^<]*)课表/im.exec(res.data)[1]

    let user = { cardnum, schoolnum, name, collegeId, collegeName, majorId, majorName }

    // 初始化侧边栏和课表解析结果
    let sidebar = {}, curriculum = {};

    // 解析侧边栏，先搜索侧边栏所在的 table
    res.data.match(/class="tableline">([\s\S]*?)<\/table/img)[0]

      // 取 table 中所有行
      .match(/<tr height="3[48]">[\s\S]*?<\/tr\s*>/img) // 老师课表是height=38

      // 去掉表头表尾
      .slice(1, -1).map(k => {

        let courseData = k.match(/<td[^>]*>(.*?)<\/td\s*>/img)
        if (isStudent) {
          // 取每行中所有五个单元格，去掉第一格，分别抽取文本并赋给课程名、教师名、学分、周次
          courseData = courseData.slice(1)
        } else {
          // 各个单元格是: (0)序号，(1)课程名称，(2)被注释掉的老师名称，(3)老师名称，(4)课程编号，(5)课程类型*，(6)考核*，(7)学分，(8)学时，(9)周次
          // * 5 和 6 标题如此，但是内容事实上是 (5)考核 (6)课程类型。
          // 这里我们取和学生课表相同的部分
          courseData = [courseData[1],courseData[3],courseData[7],courseData[9]]
        }
        let [className, teacherName, score, weeks] = courseData.map(td => cheerio.load(td).text().trim())
        score = parseFloat(score || 0)
        if (! isStudent) { // 只留下名字
          teacherName = teacherName.replace(/^\d+系 /, '')
        }

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
        // 老师课表(可能会)多出来一个空行
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
    return { term, user, curriculum }
  }
}
