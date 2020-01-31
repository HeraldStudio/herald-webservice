const cheerio = require('cheerio')
//const db = require('../../database/course')

// 折合百分制成绩（本科生用）(国内)
// 数据库数据对应等级 201 优; 202 良; 203 中; 210 通过;
const calculateEquivalentScore = score => {
  if (/201/.test(score)) {
    score = 95
  } else if (/202/.test(score)) {
    score = 85
  } else if (/203/.test(score)) {
    score = 75
  } else if (/211/.test(score)) {
    score = 0
  } else if (/210/.test(score)) {
    score = 60
  }
  return parseFloat(score) || 0
}
// 折合百分制成绩（本科生用）(国外)
const calculateEquivalentForeignScore = score => {
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
}

exports.route = {

  /**
  * GET /api/gpa
  * 成绩查询
  * 注意本科生和研究生返回结果格式略有不同
  **/
  async get() {

    let { name, cardnum } = this.user

    // 本科生
    if (/^21/.test(cardnum)) {
     if(/^21318/.test(cardnum) || /^21319/.test(cardnum)){  //18 19级
      let rawData = await this.db.execute(`
      SELECT 
        xk.XNXQDM,
        xk.KCH,
        cj.KCM,
        xk.KCXZDM,
        cj.XF,
        cj.ZCJ,
        xk.CXCKDM
      FROM
        (
            SELECT 
              newcj.KCM,
              newcj.XF,
              newcj.ZCJ,
              newcj.XH,
              newcj.KCH
            FROM
              TOMMY.T_CJ_LRCJ  newcj
            WHERE newcj.XH = :cardnum
        )  cj,
        TOMMY.T_XK_XKXS  xk
      WHERE
        cj.XH = xk.XH AND cj.KCH = xk.KCH
  `,{ cardnum: cardnum})
  let rawDetail = rawData.rows.map(row => {
    let semesterName = row[0].split('-')
    let cxckMap = new Map([['01','首修'],['02','重修'],['03','及格重修'],['04','补考']])
    let kcxzMap = new Map([['01','必修'],['02','任选'],['03','限选']])
    semesterName = `${semesterName[0].slice(2)}-${semesterName[1].slice(2)}-${semesterName[2]}`
    return {
      semester: semesterName,
      cid: row[1],
      courseName: row[2],
      courseType: kcxzMap.get(row[3]),
      credit: row[4],
      score: row[5],
      foreignScore: calculateEquivalentForeignScore(row[5]),
      equivalentScore: calculateEquivalentScore(row[5]),
      isPassed: (row[5] >= 60 && row[5] <= 100) || (row[5] > 200 && row[5] <= 210),  //右边的条件是针对老系统的等级成绩的
      isFirstPassed: false,
      isHighestPassed: false,
      scoreType: cxckMap.get(row[6])
    }
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
      indexList.forEach((detailIndex) => {
        detail.push(rawDetail[detailIndex])
      })
      //去重结束

      let courseHasPassed = {}
      let achievedCredits = 0
      detail.slice().reverse().map(k => {
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
      courseTypes = courseTypes.filter( k => k.courseType === '')

      if(courseTypes.length === 0){
        detail.map(k => {
          if(k.courseType === '限选')
            k.courseType = ''
        })
      }
        
        

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

      let gpa = null
      let calculationTime = null
      let gpaBeforeMakeup = null
      let year = null
      // 时间解析为时间戳
      //calculationTime = calculationTime ? +moment(calculationTime) : null
      this.logMsg = `${name} (${cardnum}) - 查询绩点`
      return { gpa, gpaBeforeMakeup, achievedCredits, year, calculationTime, detail }
     }
     else{  //16 17级
      let rawData = await this.db.execute(`
      SELECT 
        xk.XN,
        xk.XQ,
        xk.XKKCDM,
        cj.KCM,
        cj.XF,
        cj.ZCJ
      FROM
        (
            SELECT 
              oldcj.KCMC AS KCM,
              oldcj.XF,
              oldcj.CJ AS ZCJ,
              oldcj.XH,
              oldcj.XKKCDM
            FROM
              TOMMY.T_CJGL_KSCJXX  oldcj
            WHERE oldcj.XH = :cardnum
        )  cj,
        TOMMY.T_XK_XKJG  xk
      WHERE
        cj.XH = xk.XH AND cj.XKKCDM = xk.XKKCDM
  `,{ cardnum: cardnum})
  let rawDetail = rawData.rows.map(row => {
    let xn = parseInt(row[0]);
    let xq = parseInt(row[1]);
    let semesterName = xn.toString()+"-"+(xn+1).toString()+"-"+xq.toString();
    return {
      semester: semesterName,
      cid: row[2],
      courseName: row[3],
      courseType: undefined,
      credit: row[4],
      score: row[5],
      foreignScore: calculateEquivalentForeignScore(row[5]),
      equivalentScore: calculateEquivalentScore(row[5]),
      isPassed: (row[5] >= 60 && row[5] <= 100) || (row[5] > 200 && row[5] <= 210),  //右边的条件是针对老系统的等级成绩的
      isFirstPassed: false,
      isHighestPassed: false,
      scoreType: undefined>
    }
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
      indexList.forEach((detailIndex) => {
        detail.push(rawDetail[detailIndex])
      })
      //去重结束

      let courseHasPassed = {}
      let achievedCredits = 0
      detail.slice().reverse().map(k => {
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
      /*let courseTypes = detail.map(k => k.courseType)
      courseTypes = courseTypes.filter( k => k.courseType === '')

      if(courseTypes.length === 0){
        detail.map(k => {
          if(k.courseType === '限选')
            k.courseType = ''
        })
      }*/
        
        

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

      let gpa = null
      let calculationTime = null
      let gpaBeforeMakeup = null
      let year = null
      // 时间解析为时间戳
      //calculationTime = calculationTime ? +moment(calculationTime) : null
      this.logMsg = `${name} (${cardnum}) - 查询绩点`
      return { gpa, gpaBeforeMakeup, achievedCredits, year, calculationTime, detail }
     }


    } else if (/^22/.test(cardnum)) { // 研究生
      let headers = { 'Referer': 'http://121.248.63.139/nstudent/index.aspx' }

      // 获取成绩页
      let res = await this.get('http://121.248.63.139/nstudent/grgl/xskccjcx.aspx', { headers })
      let $ = cheerio.load(res.data)
      let detail = ['#dgData', '#Datagrid1'].map(k => $(k)).map((table, i) => {
        let scoreType = ['学位', '选修'][i]
        return table.find('tr').toArray().slice(1).map(k => $(k)).map(tr => {
          let [courseName, credit, semester, score, standardScore]
              = tr.children('td').toArray().map(k => $(k).text().trim())

          credit = parseFloat(credit)
          return { semester, courseName, courseType: '', credit, score, standardScore, scoreType }
        })
      })
        .reduce((a, b) => a.concat(b), [])
        .sort((a, b) => b.semester - a.semester)
        .reduce((a, b) => { // 按学期分组
          let semester = b.semester
          delete b.semester
          if (!a.length || a.slice(-1)[0].semester !== semester) {
            return a.concat([{ semester, courses: [b] }])
          } else {
            a.slice(-1)[0].courses.push(b)
            return a
          }
        }, [])

      let score = parseFloat($('#lblgghpjcj').text()) // 规格化平均成绩
      let degree = parseFloat($('#lblxwxf').text()) // 学位学分
      let optional = parseFloat($('#lblxxxf').text()) // 选修学分
      let total = parseFloat($('#lblyxxf').text()) // 总学分
      let required = parseFloat($('#lblyxxf1').text()) // 应修总学分
      let credits = { degree, optional, total, required }
        
        

      return { graduated: true, score, credits, detail }
    }
    
  }
}
