/* eslint no-unused-vars:off, require-atomic-updates:off */
const oracledb = require("oracledb")
const cheerio = require("cheerio")

// 每节课的开始时间 (时 * 60 + 分)
// 注：本科生和研究生的时间表完全一样。
const courseStartTime =
  "8:00|8:50|9:50|10:40|11:30|14:00|14:50|15:50|16:40|17:30|18:30|19:20|20:10"
    .split("|")
    .map((k) =>
      k
        .split(":")
        .map(Number)
        .reduce((a, b) => a * 60 + b, 0)
    )

exports.route = {
  /**
   * @api {GET} /api/curriculum 课表查询
   * @apiGroup other
   * @apiParam term 学期号（不填则为教务处设定的当前学期）
   *
   * ## 返回格式举例：
   * {
   *   term: { name, maxWeek, startDate?, endDate?, isCurrent?, isNext?, isPrev? } // 查不到开学日期时只有前两个
   *   user: { cardnum, schoolnum, name, collegeId, collegeName, majorId, majorName }
   *   curriculum: [
   *     { // 浮动课程只有前五个属性
   *       courseName, teacherName, credit,
   *       beginWeek, endWeek,       // 1 ~ 16
   *       // 非浮动课程兼有后面这些属性
   *       dayOfWeek?,               // 为了数据直观以及前端绘图方便，1-7 分别表示周一到周日
   *       flip?,                    // even 双周, odd 单周, none 全周
   *       location?,
   *       beginPeriod?, endPeriod?, // 1 ~ 13
   *       events: [
   *         { week, startTime, endTime } // 课程每一周上课的具体时间戳
   *       ]
   *     }
   *   ]
   * }
   *
   * ## 关于丁家桥课表的周次问题：
   * 在之前 webserv2 的使用中，我们发现部分院系课表的周次与常理相悖，这种现象尤以丁家桥校区为甚。
   * 经过调查，该现象是因为丁家桥校区多数院系不设短学期，短学期和秋季学期合并为一个大学期，
   * 而教务处系统不支持这种设定，致使排课老师对此进行主观处理导致的。
   * 由于不同院系排课老师理解的区别，所做的主观处理也不尽相同，具体表现有以下三种：
   *
   * 1. 短学期课表有 1-4 周，长学期课表有 1-16 周
   * 这种课表属于正常课表，不需要做任何处理即可兼容；
   *
   * 2. 短学期课表为空，长学期课表有 1-20 周
   * 这类课表出现时，老师通常让学生直接查询长学期课表，将短学期的开学日期当做长学期的开学日期。
   * 对于这类课表，我们需要在系统中将长学期开学日期向前推4周，而且短学期为空时应当主动转化为长学期查询；
   *
   * 3. 短学期课表有 1-4 周，长学期课表有 5-20 周
   * 这类课表出现时，老师通常让学生查询短学期课表作为前四周，长学期课表作为后 16 周。
   * 对于这类课表，我们需要在系统中将长学期开学日期向前推4周。
   **/
  async get({ term }) {
    let currentTerm = (this.term.currentTerm || this.term.nextTerm).name
    term = term ? term : currentTerm
    // 若为查询未来学期，可能是在选课过程中，需要减少缓存时间
    // return await this.userCache('1d+', async () => {
    let { name, cardnum, schoolnum } = this.user
    let curriculum = []

    // 针对网信建立数据中台后的新选课数据表
    const [academicYear, , academicTerm] = term.split("-")

    if (+academicYear >= 2021) {
      term = this.term.list.find((t) => t.name === term)
      if (term.name.endsWith("2") || term.name.endsWith("4")) {
        term.maxWeek = 4
      }
      if (term.name.endsWith("1") || term.name.endsWith("3")) {
        term.maxWeek = 16
      }

      curriculum = await this.userCache("1d+", async () => {
        const result = await this.db.execute(
          `
          SELECT START_WEEK,
            END_WEEK,
            BIWEEKLY,
            WEEK,
            START_COURSE_SESSION_CODE,
            END_COURSE_SESSION_CODE,
            jzg.XM,
            kcb.KCM,
            kcb.XS,
            kcb.XF,
            kcb.KCH,
            ci.CLASSROOM_NAME
          FROM T_COURSE_ARRANGE ca
            LEFT JOIN T_JZG_JBXX jzg ON FACULTY_ID = jzg.ZGH
            LEFT JOIN T_KC_KCB kcb ON COURSE_ID = kcb.KCH
            LEFT JOIN T_CLASSROOM_INFO ci ON ca.CLASSROOM_CODE = ci.CLASSROOM_CODE
          WHERE TECH_CLASS_CODE in (
            SELECT TEACH_CLASS_CODE
              FROM T_COURSE_SELECTION
            WHERE PERSON_IN_CHARGE_SEUCARD_ID = :cardnum
              AND ACADEMIC_YEAR_CODE = :academicYear
              AND ACADEMIC_TERM_CODE = :academicTerm
          )`,
          {
            cardnum,
            academicYear,
            academicTerm,
          }
        )

        // console.log(result)

        curriculum = result.rows
          .map(course => {
            return {
              courseName: course[7],
              teacherName: course[6],
              credit: course[9],
              beginWeek: +course[0],
              endWeek: +course[1],
              location: course[11],
              dayOfWeek: course[3],
              flip: +course[2] ? (+course[2] == 1 ? 'even' : 'odd') : 'none',
              beginPeriod: +course[4],
              endPeriod: +course[5]
            }
          })

        return curriculum
      })
    }

    // 新选课系统-目前使用18级本科生数据进行测试
    else if (
      /^21318/.test(cardnum) ||
      /^[0-9A-Z]{3}18/.test(schoolnum) ||
      /^21319/.test(cardnum) ||
      /^[0-9A-Z]{3}19/.test(schoolnum) ||
      /^21320/.test(cardnum) ||
      /^[0-9A-Z]{3}20/.test(schoolnum)
    ) {
      // 处理 term
      if (!term) {
        term = currentTerm
      }
      term = this.term.list.find((t) => t.name === term)
      if (term.name.endsWith("2") || term.name.endsWith("4")) {
        term.maxWeek = 4
      }
      if (term.name.endsWith("1") || term.name.endsWith("3")) {
        term.maxWeek = 16
      }
      curriculum = await this.userCache("1d+", async () => {
        // 处理 curriculum
        // 获取课表
        let result = await this.db.execute(
          ` 
          select * from (
            select a.SKZC,SKXQ,KSJC,JSJC,JASMC,KCM,
                   listagg(XM, ',') within GROUP (order by XM) over(partition by SKZC, skxq, ksjc, JSJC, KCM ) as XM,
                   ROW_NUMBER()over(partition by SKZC, skxq, ksjc, JSJC, KCM order by xm) as num,
                   XF
              from (
                select T_PK_SJDDB.SKZC,SKXQ,KSJC,JSJC,JASMC,T_KC_KCB.KCM,XM,T_KC_KCB.XF as XF
                   from (
                     select *
                     from t_xk_xkxs
                     where xh=:cardnum and xnxqdm =:termName
                   )a
                   left join t_rw_jsb
                   on a.jxbid = t_rw_jsb.jxbid
                   left join t_pk_sjddb
                   on a.jxbid = T_PK_SJDDB.JXBID
                   left join T_JAS_JBXX
                   on t_pk_sjddb.jasdm = t_jas_jbxx.jasdm
                   left join t_kc_kcb
                   on a.kch = t_kc_kcb.kch
                   left join T_JZG_JBXX
                   on T_RW_JSB.JSH = T_JZG_JBXX.ZGH
                   left join T_KC_KCB
                   on a.kch = T_KC_KCB.KCH
           ) a
           )t1  where num =1
        `,
          {
            cardnum,
            termName: term.name,
          }
        )
        result.rows.map((Element) => {
          let [SKZC, SKXQ, KSJC, JSJC, JASMC, KCM, XM, num, XF] = Element
          const course = {
            courseName: KCM,
            teacherName: XM,
            beginWeek: SKZC ? SKZC.indexOf("1") + 1 : undefined,
            endWeek: SKZC ? SKZC.lastIndexOf("1") + 1 : undefined,
            dayOfWeek: parseInt(SKXQ) ? parseInt(SKXQ) : undefined,
            // 存在非单双周情况(如3,6,9,12周上课), 因此记录原周次位图信息
            // 需要时使用周次位图信息
            weekBitMap: SKZC,
            flip: SKZC
              ? SKZC.startsWith("1010")
                ? "odd"
                : SKZC.startsWith("0101")
                  ? "even"
                  : "none"
              : "none",
            beginPeriod: parseInt(KSJC) ? parseInt(KSJC) : undefined,
            endPeriod: parseInt(JSJC) ? parseInt(JSJC) : undefined,
            location: JASMC,
            credit: XF,
          }
          // 存在部分课程没有上课周次的情况，会导致整个课表崩掉
          if (course.endWeek) curriculum.push(course)
        })
        return curriculum
      })
      let myResult = await this.db.execute(
        `
        SELECT COURSENAME, TEACHERNAME, BEGINWEEK, ENDWEEK, DAYOFWEEK, FLIP, BEGINPERIOD, ENDPERIOD, LOCATION, WID
        FROM H_MY_COURSE
        WHERE OWNER = :cardnum and SEMESTER = :termName
        `,
        {
          cardnum,
          termName: term.name,
        }
      )
      myResult.rows.map((Element) => {
        let [
          courseName,
          teacherName,
          beginWeek,
          endWeek,
          dayOfWeek,
          flip,
          beginPeriod,
          endPeriod,
          location,
          _id,
        ] = Element
        const course = {
          _id: _id,
          courseName: courseName,
          teacherName: teacherName,
          beginWeek: beginWeek,
          endWeek: endWeek,
          dayOfWeek: dayOfWeek,
          flip: flip,
          beginPeriod: beginPeriod,
          endPeriod: endPeriod,
          location: location,
          credit: "学分未知",
        }
        curriculum.push(course)
      })
      // 前端要求，除去值为null的字段
      curriculum.forEach((Element) => {
        for (let e in Element) {
          if (Element[e] === null) delete Element[e]
        }
      })
    } else if (!/^22/.test(cardnum)) {
      term = term
        .split("-")
        .map((Element) => {
          if (term.split("-").indexOf(Element) <= 1) {
            Element = Element.slice(2, 4)
          }
          return Element
        })
        .join("-")
      let result = await this.userCache("1d+", async () => {
        // 非18级本科生/教师版
        // 为了兼容丁家桥格式，短学期没有课的时候需要自动查询长学期
        // 为此不得已使用了一个循环
        do {
          // 老师的号码是1开头的九位数
          // 考虑到学号是八位数的情况
          let isStudent = !/^1\d{8}$/.exec(cardnum)
          // 抓取课表页面
          let res = await (isStudent
            ? this.post(
              "http://xk.urp.seu.edu.cn/jw_service/service/stuCurriculum.action",
              {
                queryStudentId: cardnum,
                queryAcademicYear: term || undefined,
              }
            )
            : this.post(
              // 老师课表
              "http://xk.urp.seu.edu.cn/jw_service/service/teacurriculum.action",
              {
                query_teacherId: cardnum,
                query_xnxq: term || undefined,
              }
            ))
          if (!term) {
            try {
              // 从课表页面抓取学期号
              // console.log(res.data.toString())
              term =
                /<font class="Context_title">[\s\S]*?(\d{2}-\d{2}-\d)[\s\S]*?<\/font>/im.exec(
                  res.data.toString()
                )[1]
            } catch (e) {
              console.log(e)
              throw "解析失败"
            }
          }
          term = term
            .split("-")
            .map((Element) => {
              if (term.split("-").indexOf(Element) <= 1) {
                Element = "20" + Element
              }
              return Element
            })
            .join("-")
          // 用 term 字符串从 term 中间件中拿到学期对象，这里 term 从字符串类型变成了 Object
          term = this.term.list.find((k) => k.name === term) || {
            name: term,
          }
          // 初始化侧边栏和课表解析结果
          let sidebarDict = {},
            sidebarList = []
          // 解析侧边栏，先搜索侧边栏所在的 table
          res.data
            .toString()
            .match(/class="tableline">([\s\S]*?)<\/table/gim)[0]
            // 取 table 中所有行
            .match(/<tr height="3[48]">[\s\S]*?<\/tr\s*>/gim) // 老师课表是height=38

            // 去掉表头表尾
            .slice(1, -1)
            .map((k) => {
              let courseData = k.match(/<td[^>]*>(.*?)<\/td\s*>/gim)
              if (isStudent) {
                // 取每行中所有五个单元格，去掉第一格，分别抽取文本并赋给课程名、教师名、学分、周次
                courseData = courseData.slice(1)
              } else {
                // 各个单元格是: (0)序号，(1)课程名称，(2)被注释掉的老师名称，(3)老师名称，(4)课程编号，(5)课程类型*，(6)考核*，(7)学分，(8)学时，(9)周次
                // * 5 和 6 标题如此，但是内容事实上是 (5)考核 (6)课程类型。
                // 这里我们取和学生课表相同的部分
                courseData = [
                  courseData[1],
                  courseData[3],
                  courseData[7],
                  courseData[9],
                ]
              }
              let [courseName, teacherName, credit, weeks] = courseData.map(
                (td) => cheerio.load(td).text().trim()
              )
              credit = parseFloat(credit || 0)
              let [beginWeek, endWeek] = (weeks.match(/\d+/g) || []).map((k) =>
                parseInt(k)
              )
              if (!isStudent) {
                // 只留下名字
                teacherName = teacherName.replace(/^\d+系 /, "")
              }

              // 表格中有空行，忽略空行，将非空行的值加入哈希表进行索引
              // 这里做一个修正，因为侧栏的起止星期和课表详情中的起止星期可能用不同的表示，
              // 比如侧栏中有 10-10 无线网络及安全、11-11 无线网络及安全、12-12 无线网络及安全，
              // 但课表详情中有的课写着 10-12 周。所以这里需要把侧栏中的每一周拆出来，
              if (courseName || weeks) {
                // 这个 sidebarObj 会同时用在两个地方：
                // 一方面用在 sidebarList 里面，用于记录侧栏里面哪些课没有用到；
                // 另一方面用在 sidebarDict 里面，做一套索引，用于记录每一门课每一周的课的授课老师和学分
                // 这两边一定要指向同一个对象，不要深拷贝，为了在后面操作 sidebarDict 的时候可以同时设置到 sidebarList 里面的课的 used 字段
                let sidebarObj = {
                  courseName,
                  teacherName,
                  credit,
                  beginWeek,
                  endWeek,
                }
                sidebarList.push(sidebarObj)

                for (let i = beginWeek; i <= endWeek; i++) {
                  if (!sidebarDict[courseName.trim()]) {
                    sidebarDict[courseName.trim()] = []
                  }
                  // 由于侧栏的信息不够完整，这里只能假设某一周某一课固定由某个老师来上
                  // 如果某一周某一课有多个老师和学分信息，暂且用后来的覆盖先来的，没有办法区分。
                  sidebarDict[courseName.trim()][i] = sidebarObj
                }
              }
            })

          // 方法复用，传入某个单元格的 html 内容（td 标签可有可无），将单元格中课程进行解析并放入对应星期的课程列表中
          let appendClasses = (cellContent, dayOfWeek) => {
            // 流式编程高能警告
            curriculum = curriculum.concat(
              // 在单元格内容中搜索连续的三行，使得这三行中的中间一行是 [X-X周]X-X节 的格式，对于所有搜索结果
              // 老师课表(可能会)多出来一个空行
              (
                cellContent.match(
                  /[^<>]*<br>(?:<br>)?\[\d+-\d+周]\d+-\d+节<br>[^<>]*/gim
                ) || []
              )
                .map((k) => {
                  // 在搜索结果中分别匹配课程名、起止周次、起止节数、单双周、上课地点
                  let [
                    courseName,
                    beginWeek,
                    endWeek,
                    beginPeriod,
                    endPeriod,
                    flip,
                    location,
                  ] = /([^<>]*)<br>(?:<br>)?\[(\d+)-(\d+)周](\d+)-(\d+)节<br>(\([单双]\))?([^<>]*)/
                    .exec(k)
                    .slice(1);

                  // 对于起止周次、起止节数，转化成整数
                  [beginWeek, endWeek, beginPeriod, endPeriod] = [
                    beginWeek,
                    endWeek,
                    beginPeriod,
                    endPeriod,
                  ].map((k) => parseInt(k))

                  // 对于单双周，转换成标准键值
                  flip = { "(单)": "odd", "(双)": "even" }[flip] || "none"

                  // 根据课程名和起止周次，拼接索引键，在侧栏表中查找对应的课程信息
                  // let teacherName = '', credit = ''

                  // 对于这个课的每一周，到侧栏去找对应的授课老师和学分等信息
                  let ret = []
                  let courseNameTrim = courseName.trim()
                  for (let week = beginWeek; week <= endWeek; week++) {
                    // 遇到单双周，跳过本次循环，这里是一个小 trick
                    // - 如果课程单周，当前双周，左 0 右 0，条件成立
                    // - 如果课程双周，当前单周，左 1 右 1，条件成立
                    // - 如果课程不论单双周，右边 -1，条件始终不成立
                    if (week % 2 === ["odd", "even"].indexOf(flip)) {
                      continue
                    }

                    let sidebarObj =
                      (sidebarDict[courseNameTrim] &&
                        sidebarDict[courseNameTrim][week]) ||
                      {}
                    sidebarObj.used = true

                    let { teacherName = "", credit = 0 } = sidebarObj

                    // 取到上一周这节课的信息，如果跟这一周这节课信息一致，则拓展上一周的
                    let previous = ret.length && ret.slice(-1)[0]
                    if (
                      previous &&
                      teacherName === previous.teacherName &&
                      credit === previous.credit
                    ) {
                      previous.endWeek = week // 这里不能 ++，因为单双周可能跨两周
                    } else {
                      // 否则，新增一个课，这个课暂时假设从本周开始，到本周结束
                      // 如果下一周还是同一个老师同一个学分的课，循环到下一周的时候会给 endWeek 自增的
                      ret.push({
                        courseName,
                        teacherName,
                        credit,
                        location,
                        beginWeek: week,
                        endWeek: week,
                        dayOfWeek,
                        beginPeriod,
                        endPeriod,
                        flip,
                      })
                    }
                  }

                  // 返回课程名，教师名，学分，上课地点，起止周次，起止节数，单双周，交给 concat 拼接给对应星期的课程列表
                  return ret
                })
                .reduce((a, b) => a.concat(b), [])
            )
          }

          // 对于第二个大表格
          res.data
            .toString()
            .match(/class="tableline"\s*>([\s\S]*?)<\/table/gim)[1]
            // 取出每一行最末尾的五个单元格，排除第一行
            .match(/(<td[^>]*>.*?<\/td>[^<]*){5}<\/tr/gim)
            .slice(1)
            .map((k) => {
              // 第 0 格交给周 1，以此类推
              k.match(/<td[^>]*>.*?<\/td>/gim).map((k, i) =>
                appendClasses(k, i + 1)
              )
            })

          // 取周六大单元格的内容，交给周六
          appendClasses(
            />周六<\/td>[^<]*<td[^>]*>([\s\S]*?)<\/td>/gim.exec(res.data)[1],
            6
          )

          // 取周日大单元格的内容，交给周日
          appendClasses(
            />周日<\/td>[^<]*<td[^>]*>([\s\S]*?)<\/td>/gim.exec(res.data)[1],
            7
          )

          // 将侧栏中没有用过的剩余课程（浮动课程）放到 other 字段里
          curriculum = curriculum.concat(
            Object.values(sidebarList).filter((k) => !k.used)
          )

          // 确定最大周数
          term.maxWeek = curriculum
            .map((k) => k.endWeek)
            .reduce((a, b) => (a > b ? a : b), 0)

          // 针对一些辅修课程不显示学期
          if (!term.maxWeek) {
            term.maxWeek = term.isLong ? 16 : 4
          }

          // 为了兼容丁家桥表示法，本科生和教师碰到秋季学期超过 16 周的课表，将开学日期前推四周
          if (
            term.maxWeek > 16 &&
            !/^22/.test(cardnum) &&
            /-2$/.test(term.name)
          ) {
            term.startDate -= moment.duration(4, "weeks")
          }
        } while ( // 为了兼容丁家桥表示法
          !curriculum.length && // 如果没有课程
          /-1$/.test(term.name) && // 而且当前查询的是短学期
          (term = term.name.replace(/-1$/, "-2")) // 则改为查询秋季学期，重新执行
        )
        return { term, curriculum }
      })
      term = result.term
      curriculum = result.curriculum
      // 添加自定义课程
      let myResult = await this.db.execute(
        `
SELECT COURSENAME, TEACHERNAME, BEGINWEEK, ENDWEEK, DAYOFWEEK, FLIP, BEGINPERIOD, ENDPERIOD, LOCATION, WID
FROM H_MY_COURSE
WHERE OWNER = :cardnum and SEMESTER = :termName
`,
        {
          cardnum,
          termName: term.name,
        }
      )
      myResult.rows.map((Element) => {
        let [
          courseName,
          teacherName,
          beginWeek,
          endWeek,
          dayOfWeek,
          flip,
          beginPeriod,
          endPeriod,
          location,
          id,
        ] = Element
        const course = {
          courseName: courseName,
          teacherName: teacherName,
          beginWeek: beginWeek,
          endWeek: endWeek,
          dayOfWeek: dayOfWeek,
          flip: flip,
          beginPeriod: beginPeriod,
          endPeriod: endPeriod,
          location: location,
          credit: "学分未知",
          _id: id,
        }
        curriculum.push(course)
      })
    } else if (/^22/.test(cardnum)) {
      // 研究生版
      // await this.useAuthCookie()
      let headers = { Referer: "http://121.248.63.139/nstudent/index.aspx" }

      // 获取课程列表页
      // 这里不能使用二维课表页面，因为二维课表页面在同一单元格有多节课程时，课程之间不换行，很难解析
      // let res = await this.get('http://121.248.63.139/nstudent/pygl/pyxkcx.aspx', { headers })
      // let $ = cheerio.load(res.data)

      // if (!term) { term = currentTerm }
      // let endYear = term.split('-')[1]
      // let period = term.split('-')[2]
      // //let [beginYear, endYear, period] = term.split('-')
      // period = ['短学期', '秋学期', '春学期'][period - 1]
      // let re = RegExp(`${endYear}${period}$`)
      // let option = $('#txtxq option').toArray().map(k => $(k))
      //   .find(k => re.test(k.text()))

      // if (!option) {
      //   // 用 term 字符串从 term 中间件中拿到学期对象，这里 term 从字符串类型变成了 Object
      //   term = this.term.list.find(k => k.name === term) || {
      //     name: term
      //   }
      //   return { term, curriculum: [] }
      // }

      //zlr新加
      let time = term.split(/-/)
      let schoolYear = time[0]
      let period = time[2]
      let record = await this.db.execute(
        `select tyx.xn, xqdm, kc.KCMC,kc.XF,jzg.xm, kcap.SKAP, js.JASMC, kcap.JSDM
          from T_YJS_XSXK tyx
          inner join T_YJS_KCAP kcap on tyx.KCDM = kcap.KCDM and tyx.XKKCH = kcap.XKKCH 
          and tyx.XN = :schoolYear and tyx.XQDM = :period
          left join T_YJS_KC kc on kcap.KCDM = kc.KCDM
          left join T_JAS_JBXX js on kcap.JSDM = js.JASDM
          left join T_JZG_JBXX jzg on kcap.JSGH = jzg.ZGH
          where tyx.WZXH = :cardnum
        `,
        [schoolYear, period, cardnum]
      )
      console.log(record)
      //220171650
      // get api/curriculum?term=2018-2019-2
      record.rows.forEach((element) => {
        let [XN, XQDM, courseName, XF, XM, period, JASMC, JSDM] = element
        let name = XN + "-" + (parseInt(XN) + 1) + "-" + XQDM //（类似于2019-2020-2）
        if (period) {
          let [weekPeriod, dayPeriod] = period.split(/;\s/)
          let [beginWeek, endWeek] = weekPeriod.match(/\d+/g).map(Number)
          dayPeriod = dayPeriod.split(/\s/)
          dayPeriod.forEach((dayPeriods) => {
            let [days, periods] = dayPeriods.split(/-/)
            let dayOfWeek =
              "一二三四五六日".indexOf(days.split("").slice(-1)[0]) + 1
            periods = periods
              .split(/,/)
              .map(
                (p) => "上下晚".indexOf(p[0]) * 5 + Number(/\d+/.exec(p)[0])
              )
            let beginPeriod = periods.filter(
              (k, i, a) => i === 0 || a[i] !== a[i - 1] + 1
            )
            let endPeriod = periods.filter(
              (k, i, a) => i === a.length - 1 || a[i] !== a[i + 1] - 1
            )
            curriculum.push({
              courseName,
              teacherName: XM,
              credit: XF,
              location: JASMC,
              beginWeek,
              endWeek,
              dayOfWeek,
              beginPeriod: beginPeriod[0],
              endPeriod: endPeriod[0],
              flip: "none",
            })
          })
        }
      })

      // let data = {
      //   '__EVENTTARGET': 'txtxq',
      //   '__EVENTARGUMENT': '',
      //   'txtxq': option.attr('value')
      // }

      // $('input[name="__VIEWSTATE"]').toArray().map(k => $(k)).map(k => {
      //   data[k.attr('name')] = k.attr('value')
      // })

      //   res = await this.post('http://121.248.63.139/nstudent/pygl/pyxkcx.aspx', data)
      //   $ = cheerio.load(res.data)
      // }

      //将学期号转换为本科生风格的学期号（但只有 -2 和 -3），统一格式
      // term = $('option[selected]').text().trim().replace(/\d{2}(\d{2})/g, '$1')
      //   .replace('秋学期', '-2').replace('春学期', '-3')
      // 用 term 字符串从 term 中间件中拿到学期对象，这里 term 从字符串类型变成了 Object

      term = this.term.list.find((k) => k.name === term) || {
        name: term,
      }

      // 研究生无短学期，秋季学期提前两周开始
      if (/-2$/.test(term.name)) {
        term.startDate -= moment.duration(2, "weeks")
      }

      // 课表信息，与本科生格式完全一致
      // curriculum = $('table.GridBackColor tr').toArray().slice(1, -1).map(k => $(k)).map(tr => {
      //   let [className, location, department, id, courseName, teacherName, period, hours, credit, degree]
      //     = tr.children('td').toArray().map(k => $(k).text())
      //   credit = parseFloat(credit || 0)
      //   let [weekPeriod, dayPeriod] = period.split(/;\s*/)
      //   let [beginWeek, endWeek] = weekPeriod.match(/\d+/g).map(Number)
      //   let days = dayPeriod.split(/\s+/)
      //   return days.map(day => {
      //     let [dayOfWeek, periods] = day.split(/-/)
      //     dayOfWeek = '一二三四五六日'.indexOf(dayOfWeek.split('').slice(-1)[0]) + 1
      //     periods = periods.split(/,/g).map(p => '上下晚'.indexOf(p[0]) * 5 + Number(/\d+/.exec(p)[0]))
      //     let begins = periods.filter((k, i, a) => i === 0 || a[i] !== a[i - 1] + 1)
      //     let ends = periods.filter((k, i, a) => i === a.length - 1 || a[i] !== a[i + 1] - 1)
      //     return begins.map((k, i) => ({
      //       courseName: className,
      //       teacherName, credit, location,
      //       beginWeek, endWeek,
      //       dayOfWeek,
      //       beginPeriod: k,
      //       endPeriod: ends[i],
      //       flip: 'none'
      //     }))
      //   }).reduce((a, b) => a.concat(b), [])
      // }).reduce((a, b) => a.concat(b), [])
    } else {
      curriculum = []
    }

    // if 本科生 / 研究生
    // 给有上课时间的课程添加上课具体周次、每周上课的具体起止时间戳
    curriculum.map((k) => {
      let { beginWeek, endWeek, dayOfWeek, beginPeriod, endPeriod, flip } = k
      if (dayOfWeek) {
        if ("weekBitMap" in k && flip === "none") {
          // 3,6,9,12周有课或4,8,12,16周有课的情况下, flip为none
          k.events = []
          for (let i = 0, len = k["weekBitMap"].length; i < len; i++) {
            if (k["weekBitMap"][i] === "1") {
              k.events.push(i + 1)
            }
          }
          k.events = k.events.map((week) => ({
            week,
            startTime:
              term.startDate +
              ((week * 7 + dayOfWeek - 8) * 1440 +
                courseStartTime[beginPeriod - 1]) *
                60000,
            endTime:
              term.startDate +
              ((week * 7 + dayOfWeek - 8) * 1440 +
                courseStartTime[endPeriod - 1] +
                45) *
                60000,
          }))
        } else {
          k.events = Array(endWeek - beginWeek + 1)
            .fill()
            .map((_, i) => i + beginWeek)
            .filter((i) => i % 2 !== ["odd", "even"].indexOf(flip))
            .map((week) => ({
              week,
              startTime:
                term.startDate +
                ((week * 7 + dayOfWeek - 8) * 1440 +
                  courseStartTime[beginPeriod - 1]) *
                  60000,
              endTime:
                term.startDate +
                ((week * 7 + dayOfWeek - 8) * 1440 +
                  courseStartTime[endPeriod - 1] +
                  45) *
                  60000,
            }))
        }
      }
    })

    // 应对jwc完全没有时间的情况
    curriculum.map((k) => {
      k.beginWeek = k.beginWeek ? k.beginWeek : 1
      k.endWeek = k.endWeek ? k.endWeek : term.maxWeek
    })
    this.logMsg = `${name} (${cardnum}) - 查询课程表`
    return { term, curriculum }
  },

  /**
   * @api {POST} /api/curriculum 自定义课程
   * @apiGroup other
   * @apiParam courseName  课程名
   * @apiParam teacherName 老师名
   * @apiParam beginWeek   开始周次
   * @apiParam endWeek     结束周次`
   * @apiParam dayOfWeek   星期几      // 为了数据直观以及前端绘图方便，1-7 分别表示周一到周日
   * @apiParam flip        单双周      // even 双周, odd 单周, none 全周
   * @apiParam beginPeriod 开始节次
   * @apiParam endPeriod   结束节次
   * @apiParam location    地点
   **/

  async post({
    courseName,
    teacherName,
    beginWeek,
    endWeek,
    dayOfWeek,
    flip,
    beginPeriod,
    endPeriod,
    location,
  }) {
    let { cardnum } = this.user
    if (!courseName) {
      throw "课程名未定义"
    }
    if (!beginWeek || !endWeek) {
      throw "周次未定义"
    }
    if (!flip) {
      flip = "none"
    }
    let sql, binds, options, result
    sql = `INSERT INTO H_MY_COURSE VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9, sys_guid(), :10, '${this.term.currentTerm.name}')`

    binds = [
      [
        courseName,
        teacherName,
        beginWeek,
        endWeek,
        dayOfWeek,
        flip,
        beginPeriod,
        endPeriod,
        location,
        cardnum,
      ],
    ]
    options = {
      autoCommit: true,

      bindDefs: [
        { type: oracledb.STRING, maxSize: 100 },
        { type: oracledb.STRING, maxSize: 90 },
        { type: oracledb.NUMBER },
        { type: oracledb.NUMBER },
        { type: oracledb.NUMBER },
        { type: oracledb.STRING, maxSize: 10 },
        { type: oracledb.NUMBER },
        { type: oracledb.NUMBER },
        { type: oracledb.STRING, maxSize: 200 },
        { type: oracledb.STRING, maxSize: 20 },
      ],
    }

    result = await this.db.executeMany(sql, binds, options)

    if (result.rowsAffected > 0) {
      return "自定义课程成功"
    } else {
      throw "自定义课程失败"
    }
  },
  /**
   * @api {DELETE} /api/curriculum 删除自定义课程
   * @apiGroup other
   * @apiParam _id
   */
  async delete({ _id }) {
    let record = await this.db.execute(
      `
    select * from H_MY_COURSE
    where wid= :id
  `,
      {
        id: _id,
      }
    )
    record = record.rows[0]

    if (!record) {
      throw "事务不存在"
    }

    let result = await this.db.execute(
      `
    DELETE from H_MY_COURSE
    WHERE WID =:id
  `,
      { id: _id }
    )
    if (result.rowsAffected > 0) {
      return "删除成功"
    } else {
      throw "删除失败"
    }
  },
}
