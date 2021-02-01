// const cheerio = require('cheerio')
const oracledb = require('oracledb')
//const db = require('../../database/course')

// 折合百分制成绩（本科生用）(国内)
// 数据库数据对应等级 201 优; 202 良; 203 中; 204 及格; 205 不及格；207 缺考；206 缓考；208 作弊；209 免修；
// 210 通过；211 出国交流认定；301 作弊；302 违纪；303 严重违纪；
const calculateEquivalentScore = score => {
  if (/201/.test(score)) {
    score = 95
  } else if (/202/.test(score)) {
    score = 85
  } else if (/203/.test(score)) {
    score = 75
  } else if (/204/.test(score)) {
    score = 60
  } else if (/211|205|206|207|208|301|302|303/.test(score)) {
    score = 0
  } else if (/210/.test(score)) {
    score = 60
  }
  return parseFloat(score) || 0
}
// 折合百分制成绩（本科生用）(国外)
/*const calculateEquivalentForeignScore = score => {
  if (/201/.test(score)) {
    score = 97
  } else if (/202/.test(score)) {
    score = 87
  } else if (/203/.test(score)) {
    score = 77
  } else if (/211/.test(score)) {
    score = 0
  } else if (/210/.test(score)) {
    score = 60
  }
  return parseFloat(score) || 0
}*/
/**
 * @apiDefine gpa gpa相关接口
 */
exports.route = {
  /**
  * @api {GET} /api/gpa 查询绩点信息
  * @apiGroup gpa 
  */
  /**
  * GET /api/gpa
  * 成绩查询
  * 注意本科生和研究生返回结果格式略有不同
  **/
  async get() {
    let { name, cardnum } = this.user

    // 本科生
    if (/^21/.test(cardnum)) {
      if (/^21318/.test(cardnum) || /^21319/.test(cardnum) || /^21320/.test(cardnum)) {  //18 19级
        let detail = await this.userCache('1h+', async () => {
          let rawData = await this.db.execute(`
          select XNXQDM,a.WID,KCM,KCXZDM,XF,ZCJ,CXCKDM
          from (
            select *
            from T_CJ_LRCJ
            where xh =:cardnum
          )a
          left join T_XK_XKXS
          on a.xh = T_XK_XKXS.xh and a.kch = T_XK_XKXS.kch
        `, { cardnum: cardnum })
          let rawDetail = []
          rawData.rows.map(row => {
            let [semester, cid, courseName, courseType, credit, score, scoreType] = row
            score = parseInt(score)
            let semesterName = semester ? semester.split('-') : '其他'
            let cxckMap = new Map([['01', '首修'], ['02', '重修'], ['03', '及格重修'], ['04', '补考']])
            let kcxzMap = new Map([['01', '必修'], ['02', '任选'], ['03', '限选']])
            if (semesterName !== '其他') { semesterName = `${semesterName[0].slice(2)}-${semesterName[1].slice(2)}-${semesterName[2]}` }
            const gpa = {
              semester: semesterName,
              cid: cid,
              courseNumber: cid,
              courseName: courseName,
              courseType: kcxzMap.get(courseType),
              credit: credit,
              score: calculateEquivalentScore(score),
              isPassed: (score >= 60 && score <= 100) || (score > 200 && score <= 210),  //右边的条件是针对老系统的等级成绩的
              isFirstPassed: false,
              isHighestPassed: false,
              scoreType: cxckMap.get(scoreType)
            }
            rawDetail.push(gpa)
          })

          //对数据rawDetail进行去重，依靠课程代码进行去重
          //及格重修的课程代码与首修课程代码相同，将来可能会产生bug，希望以后可以不用数据去重
          let cidList = {}
          let indexList = []
          rawDetail.forEach((currentTerm, index) => {
            if (cidList[currentTerm.cid] !== true) {
              cidList[currentTerm.cid] = true
              indexList.push(index)
            }
          })
          let detail = []

          // 暂停查询
          // if (['213183580', '213181432'].indexOf(cardnum) !== -1)
          indexList.forEach((detailIndex) => {
            detail.push(rawDetail[detailIndex])
          })

          //去重结束
          return detail
        })

        //获取自定义的成绩
        let myexamData = await this.db.execute(`
        SELECT * FROM TOMMY.H_MY_SCORE
            WHERE CARDNUM = :cardnum
    `, { cardnum: cardnum })

        myexamData.rows.map(row => {
          // eslint-disable-next-line no-unused-vars
          let [_id, courseName, credit, score, courseType, scoreType, cardnum, semester] = row
          const mygpa = {
            _id: _id,
            semester: semester,
            courseName: courseName,
            courseType: courseType,
            credit: credit,
            score: calculateEquivalentScore(score),
            isPassed: (score >= 60 && score <= 100) || (score > 200 && score <= 210),  //右边的条件是针对老系统的等级成绩的
            isFirstPassed: true,
            isHighestPassed: true,
            scoreType: scoreType
          }
          detail.push(mygpa)
        })
        // 前端要求，除去值为null的字段
        detail.forEach(Element => {
          for (let e in Element) {
            if (Element[e] === null)
              delete Element[e]
          }
        })

        let courseHasPassed = {}
        let achievedCredits = 0
        detail.slice().reverse().map(k => {
          // 对自定义课程另外处理
          if (k._id !== undefined) {
            achievedCredits += k.credit
          }
          // 赋值后判断如果是首次通过
          if ((k.isFirstPassed = k.isPassed && !courseHasPassed[k.cid])) {
            courseHasPassed[k.cid] = true

            // 更新已获得学分数
            achievedCredits += k.credit
          }
        })


        // 计算各门课程是否最高一次通过
        // 用于前端判断课程是否默认计入出国绩点估算
        let courseHighestPassed = {}
        detail.map(k => {
          if (k.isPassed && (!courseHighestPassed[k.cid] || k.equivalentScore > courseHighestPassed[k.cid].equivalentScore)) {
            courseHighestPassed[k.cid] = k
          }
        })
        Object.values(courseHighestPassed).map(k => k.isHighestPassed = true)

        // 解决转系生课程全为任选或限选的状况
        let courseTypes = detail.map(k => k.courseType)

        courseTypes = courseTypes.filter(k => k === '')

        if (courseTypes.length === 0) {
          detail.map(k => {
            if (k.courseType === '限选')
              k.courseType = ''
          })
        }
        //先按学期进行排序，因为从数据库库查出来的数据不是按学期顺序排下来的
        detail = detail.sort((a, b) => {
          if (a.semester < b.semester) {
            return -1
          }
          if (a.semester > b.semester) {
            return 1
          }
          return 0
        })
        // 按学期分组
        detail = detail.reduce((a, b) => {
          let semester = b.semester
          delete b.semester
          if (!a.length || a.slice(-1)[0].semester !== semester) {
            return a.concat([{ semester, courses: [b] }])
          } else {
            a.slice(-1)[0].courses.push(b)
            return a
          }
        }, [])

        // 初始化学期列表（app在没有成绩信息的时候无法自定义成绩
        let semesters = []
        this.term.list.map(Element => {
          if (parseInt(Element.name.slice(2, 4)) >= parseInt(this.user.cardnum.slice(3, 5))) {
            semesters.push({
              semester: Element.name.split('-').map((Element, index) => {
                return index < 2 ? Element.slice(2) : Element
              }).join('-'),
              courses: []
            })
          }
        })
        for (let element in semesters) {
          let flag = false
          for (let e in detail) {
            if (element.semester === e.semester) {
              flag = true
              break
            }
          }
          if (!flag) {
            detail.push(element)
          }
        }


        this.logMsg = `${name} (${cardnum}) - 查询绩点`
        return { achievedCredits, detail }
      }
      else {  //16 17级
        let detail = await this.userCache('1h+', async () => {
          let rawData = await this.db.execute(`
          SELECT 
          cj.KSXN,
          cj.KSXQ,
          xk.XKKCDM,
          cj.KCM,
          cj.XF,
          cj.ZCJ,
          cj.wid
        FROM
          (
            SELECT 
              oldcj.KCMC AS KCM,
              oldcj.XF,
              oldcj.CJ AS ZCJ,
              oldcj.XH,
              oldcj.XKKCDM,
              oldcj.KSXN,
              oldcj.KSXQ,
              oldcj.wid
            FROM
              TOMMY.T_CJGL_KSCJXX  oldcj
            WHERE oldcj.XH = :cardnum
          )  cj
          left join TOMMY.T_XK_XKJG  xk
          on cj.XH = xk.XH AND cj.XKKCDM = xk.XKKCDM
      `, { cardnum: cardnum })

          let rawDetail = []
          rawData.rows.map(row => {
            let [xn, xq, cid, courseName, credit, score, wid] = row
            xn = parseInt(xn)
            xq = parseInt(xq)
            score = parseInt(score)
            let semesterName = xn.toString().slice(2) + "-" + (xn + 1).toString().slice(2) + "-" + xq.toString()
            const gpa = {
              semester: semesterName,
              cid: wid,
              courseNumber: cid ? cid : wid,
              courseName: courseName,
              courseType: undefined,
              credit: credit,
              score: calculateEquivalentScore(score),
              isPassed: (score >= 60 && score <= 100) || (score > 200 && score <= 210),  //右边的条件是针对老系统的等级成绩的
              isFirstPassed: false,
              isHighestPassed: false,
              scoreType: undefined
            }
            rawDetail.push(gpa)
          })
          // 针对部分数据横跨新老系统的同学
          rawData = await this.db.execute(`
          select XNXQDM,a.KCH,KCM,KCXZDM,XF,ZCJ,CXCKDM
          from (
            select *
            from T_CJ_LRCJ
            where xh =:cardnum
          )a
          left join T_XK_XKXS
          on a.xh = T_XK_XKXS.xh and a.kch = T_XK_XKXS.kch
        `, { cardnum: cardnum })
          rawData.rows.map(row => {
            let [semester, cid, courseName, courseType, credit, score, scoreType] = row
            let semesterName = semester ? semester.split('-') : '其他'
            let cxckMap = new Map([['01', '首修'], ['02', '重修'], ['03', '及格重修'], ['04', '补考']])
            let kcxzMap = new Map([['01', '必修'], ['02', '任选'], ['03', '限选']])
            if (semesterName !== '其他') { semesterName = `${semesterName[0].slice(2)}-${semesterName[1].slice(2)}-${semesterName[2]}` }
            const gpa = {
              semester: semesterName,
              cid: cid + semesterName,
              courseNumber: cid,
              courseName: courseName,
              courseType: kcxzMap.get(courseType),
              credit: credit,
              score: calculateEquivalentScore(score),
              isPassed: (score >= 60 && score <= 100) || (score > 200 && score <= 210),  //右边的条件是针对老系统的等级成绩的
              isFirstPassed: false,
              isHighestPassed: false,
              scoreType: cxckMap.get(scoreType)
            }
            rawDetail.push(gpa)
          })
          //对数据rawDetail进行去重，依靠课程代码进行去重
          //及格重修的课程代码与首修课程代码相同，将来可能会产生bug，希望以后可以不用数据去重
          // let cidList = {}
          let indexList = []
          rawDetail.forEach((currentTerm, index) => {
            indexList.push(index)
          })
          let detail = []

          // 暂停查询
          // if (['213183580', '213181432'].indexOf(cardnum) !== -1)
          indexList.forEach((detailIndex) => {
            detail.push(rawDetail[detailIndex])
          })

          //去重结束
          return detail
        })
        //获取自定义的成绩
        let myexamData = await this.db.execute(`
        SELECT * FROM TOMMY.H_MY_SCORE
            WHERE CARDNUM = :cardnum
    `, { cardnum: cardnum })
        myexamData.rows.map(row => {
          // eslint-disable-next-line no-unused-vars
          let [_id, courseName, credit, score, courseType, scoreType, cardnum, semester] = row
          const mygpa = {
            _id: _id,
            semester: semester,
            courseName: courseName,
            courseType: courseType,
            credit: credit,
            score: calculateEquivalentScore(score),
            isPassed: (score >= 60 && score <= 100) || (score > 200 && score <= 210),  //右边的条件是针对老系统的等级成绩的
            isFirstPassed: true,
            isHighestPassed: true,
            scoreType: scoreType
          }
          detail.push(mygpa)
        })
        detail.forEach(Element => {
          for (let e in Element) {
            if (Element[e] === null)
              delete Element[e]
          }
        })
        let courseHasPassed = {}
        let achievedCredits = 0
        detail.slice().reverse().map(k => {
          // 对自定义课程另外处理
          if (k._id !== undefined) {
            achievedCredits += k.credit
          }
          // 赋值后判断如果是首次通过
          if ((k.isFirstPassed = k.isPassed && !courseHasPassed[k.cid])) {
            courseHasPassed[k.cid] = true

            // 更新已获得学分数
            achievedCredits += k.credit
          }
        })

        // 计算各门课程是否最高一次通过
        // 用于前端判断课程是否默认计入出国绩点估算
        let courseHighestPassed = {}
        detail.map(k => {
          if (k.isPassed && (!courseHighestPassed[k.cid] || k.equivalentScore > courseHighestPassed[k.cid].equivalentScore)) {
            courseHighestPassed[k.cid] = k
          }
        })
        Object.values(courseHighestPassed).map(k => k.isHighestPassed = true)

        //先按学期进行排序，因为从数据库库查出来的数据不是按学期顺序排下来的
        detail = detail.sort((a, b) => {
          if (a.semester < b.semester) {
            return -1
          }
          if (a.semester > b.semester) {
            return 1
          }
          return 0
        })
        // 按学期分组
        detail = detail.reduce((a, b) => {
          let semester = b.semester
          delete b.semester
          if (!a.length || a.slice(-1)[0].semester !== semester) {
            return a.concat([{ semester, courses: [b] }])
          } else {
            a.slice(-1)[0].courses.push(b)
            return a
          }
        }, [])

        // 初始化学期列表（app在没有成绩信息的时候无法自定义成绩
        let semesters = []
        this.term.list.map(Element => {
          if (parseInt(Element.name.slice(2, 4)) >= parseInt(this.user.cardnum.slice(3, 5))) {
            semesters.push({
              semester: Element.name.split('-').map((Element, index) => {
                return index < 2 ? Element.slice(2) : Element
              }).join('-'),
              courses: []
            })
          }
        })
        for (let element in semesters) {
          let flag = false
          for (let e in detail) {
            if (element.semester === e.semester) {
              flag = true
              break
            }
          }
          if (!flag) {
            detail.push(element)
          }
        }

        // 时间解析为时间戳
        this.logMsg = `${name} (${cardnum}) - 查询绩点`
        // ⚠️ 出现数据同步的问题，停止查询
        return { achievedCredits, detail }
      }
    } else if (/^ 22 /.test(cardnum)) { // 研究生

      let record = await this.db.execute(
        `select tyk.XQMC,tyk.WID,tyk.KSCJ,tyk.XF,tyk.SFXWK,tyk.KSLBDM, tykc.KCMC
        from T_YJS_KSCJ tyk
        left join T_YJS_KC tykc on tyk.KCDM = tykc.KCDM
        inner join T_YJS TY on tyk.XH = TY.XH
        where TY.XH = :cardnum
      `, [cardnum])

      let detail = []
      record.rows.forEach(
        element => {
          let [semester, WID, score, credit, courseType, scoreType, courseName] = element
          let cur = semester.replace(/\d{2}(\d{2})/g, '$1')
            .replace('秋学期', '-1').replace('春学期', '-2')
          semester = cur
          let kslbMap = new Map([['1', '首修'], ['2', '缓考'], ['3', '旷考'], ['4', '补考'], ['5', '补考'], ['6', '重修'], ['7', '免修']])
          let cxckMap = new Map([['0', '选修'], ['1', '学位']])
          detail.push({
            semester,
            cid: WID,
            courseNumber: WID,
            courseName,
            courseType: cxckMap.get(courseType),
            credit,
            score,
            isPassed: true,
            isFirstPassed: true,
            isHighestPassed: true,
            scoreType: kslbMap.get(scoreType)
          })
        }
      )

      //先按学期进行排序，因为从数据库库查出来的数据不是按学期顺序排下来的
      detail = detail.sort((a, b) => {
        if (a.semester < b.semester) {
          return -1
        }
        if (a.semester > b.semester) {
          return 1
        }
        return 0
      })
      // 按学期分组
      detail = detail.reduce((a, b) => {
        let semester = b.semester
        delete b.semester
        if (!a.length || a.slice(-1)[0].semester !== semester) {
          return a.concat([{ semester, courses: [b] }])
        } else {
          a.slice(-1)[0].courses.push(b)
          return a
        }
      }, [])

      // 初始化学期列表（app在没有成绩信息的时候无法自定义成绩
      let semesters = []
      this.term.list.map(Element => {
        if (parseInt(Element.name.slice(2, 4)) >= parseInt(this.user.cardnum.slice(3, 5))) {
          semesters.push({
            semester: Element.name.split('-').map((Element, index) => {
              return index < 2 ? Element.slice(2) : Element
            }).join('-'),
            courses: []
          })
        }
      })
      for (let element in semesters) {
        let flag = false
        for (let e in detail) {
          if (element.semester === e.semester) {
            flag = true
            break
          }
        }
        if (!flag) {
          detail.push(element)
        }
      }

      // 时间解析为时间戳
      //calculationTime = calculationTime ? +moment(calculationTime) : null
      // this.logMsg = `${name} (${cardnum}) - 查询绩点`
      // ⚠️ 出现数据同步的问题，停止查询
      return { detail }

      // let headers = { 'Referer': 'http://121.248.63.139/nstudent/index.aspx' }

      // // 获取成绩页
      // let res = await this.get('http://121.248.63.139/nstudent/grgl/xskccjcx.aspx', { headers })
      // let $ = cheerio.load(res.data)
      // let detail = ['#dgData', '#Datagrid1'].map(k => $(k)).map((table, i) => {
      //   let scoreType = ['学位', '选修'][i]
      //   return table.find('tr').toArray().slice(1).map(k => $(k)).map(tr => {
      //     let [courseName, credit, semester, score, standardScore]
      //       = tr.children('td').toArray().map(k => $(k).text().trim())

      //     credit = parseFloat(credit)
      //     return { semester, courseName, courseType: '', credit, score, standardScore, scoreType }
      //   })
      // })
      //   .reduce((a, b) => a.concat(b), [])
      //   .sort((a, b) => b.semester - a.semester)
      //   .reduce((a, b) => { // 按学期分组
      //     let semester = b.semester
      //     delete b.semester
      //     if (!a.length || a.slice(-1)[0].semester !== semester) {
      //       return a.concat([{ semester, courses: [b] }])
      //     } else {
      //       a.slice(-1)[0].courses.push(b)
      //       return a
      //     }
      //   }, [])

      // let score = parseFloat($('#lblgghpjcj').text()) // 规格化平均成绩
      // let degree = parseFloat($('#lblxwxf').text()) // 学位学分
      // let optional = parseFloat($('#lblxxxf').text()) // 选修学分
      // let total = parseFloat($('#lblyxxf').text()) // 总学分
      // let required = parseFloat($('#lblyxxf1').text()) // 应修总学分
      // let credits = { degree, optional, total, required }
      // return { graduated: true, score, credits, detail }
    }



  },
  /**
  * @api {POST} /api/gpa 创建自定义考试课程
  * @apiGroup gpa
  * @apiParam {String} courseName  课程名
  * @apiParam {Number} credit      学分
  * @apiParam {Number} score       分数
  * @apiParam {String} courseType  课程类型
  * @apiParam {String} scoreType   修读类型   
  * @apiParam {String} semester    学期
  **/
  async post({ courseName, credit, score, courseType, scoreType, semester }) {
    let { cardnum } = this.user
    if (!courseName) {
      throw '未定义课程名'
    }
    if (!credit) {
      throw '未定义学分'
    }
    if (!score) {
      throw '未定义分数'
    }
    if (!semester) {
      throw '未定义学期'
    }

    let sql = `INSERT INTO H_MY_SCORE VALUES (sys_guid()，:1, :2, :3, :4, :5, :6, :7 )`

    let binds = [
      [courseName, Number(credit), Number(score), courseType, scoreType, cardnum, semester],
    ]
    let options = {
      autoCommit: true,

      bindDefs: [
        { type: oracledb.STRING, maxSize: 40 },
        { type: oracledb.NUMBER },
        { type: oracledb.NUMBER },
        { type: oracledb.STRING, maxSize: 20 },
        { type: oracledb.STRING, maxSize: 20 },
        { type: oracledb.STRING, maxSize: 20 },
        { type: oracledb.STRING, maxSize: 20 },
      ]
    }

    let result = await this.db.executeMany(sql, binds, options)

    if (result.rowsAffected > 0) {
      return '自定义成绩成功'
    } else {
      throw '自定义成绩失败'
    }
  },

  /**
    * @api {DELETE} /api/gpa 删除自定义考试课程
    * @apiGroup gpa
    * @apiParam {String} _id  课程ID 
  **/

  async delete({ _id }) {
    let record = await this.db.execute(`
    SELECT * FROM H_MY_SCORE
    WHERE ID=:id
  `, { id: _id })
    record = record.rows[0]

    if (!record) {
      throw '事务不存在'
    }

    let result = await this.db.execute(`
    DELETE FROM H_MY_SCORE
    WHERE ID =:id
    `, { id: _id })
    if (result.rowsAffected > 0) {
      return '删除成功'
    } else {
      throw '删除失败'
    }
  },

  /**
    * @api {PUT} /api/gpa 修改自定义考试课程
    * @apiGroup gpa
    * @apiParam {String} courseName  课程名
    * @apiParam {Number} credit      学分
    * @apiParam {Number} score       分数
    * @apiParam {String} courseType  课程类型
    * @apiParam {String} scoreType   修读类型   
    * @apiParam {String} semester    学期
    * @apiParam {String} _id         课程ID
    **/
  async put({ _id, courseName, credit, score, courseType, scoreType, semester }) {

    if (!_id) {
      throw '未定义id'
    }

    let record = await this.db.execute(`
    SELECT * FROM H_MY_SCORE
    WHERE ID=:id
    `, { id: _id })
    record = record.rows[0]

    if (!record) {
      throw '事务不存在'
    }

    if (!courseName) {
      courseName = record[1]
    }
    if (!credit) {
      credit = record[2]
    }
    if (!score) {
      score = record[3]
    }
    if (!courseType) {
      courseType = record[4]
    }
    if (!scoreType) {
      scoreType = record[5]
    }
    if (!semester) {
      semester = record[7]
    }

    let result = await this.db.execute(`
    UPDATE H_MY_SCORE SET 
      COURSENAME=:courseName, 
      CREDIT=:credit, 
      SCORE=:score, 
      COURSETYPE=:courseType, 
      SCORETYPE=:scoreType, 
      SEMESTER=:semester 
    WHERE ID=:id
    `, {
      courseName,
      credit,
      score,
      courseType,
      scoreType,
      semester,
      id: _id
    })

    if (result.rowsAffected > 0) {
      return '更新成功'
    } else {
      throw '更新失败'
    }
  }

}
