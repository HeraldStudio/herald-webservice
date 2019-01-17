const cheerio = require('cheerio')

exports.route = {

  /**
  * GET /api/exam
  * 个人考试信息查询
  **/

  async get() {
    let cacheResult = await this.userCache('12h', async () => {

      let { name, cardnum, schoolnum } = this.user
      let now = +moment()
      
      // 新考试安排系统-目前使用18级本科生数据进行测试
       if (/^21318/.test(cardnum) || /^[0-9A-Z]{3}18/.test(schoolnum)) { 

        await this.useEHallAuth('4768687067472349')

        // 获取学期代号
        let termRes = await this.post('http://ehall.seu.edu.cn/jwapp/sys/studentWdksapApp/modules/wdksap/dqxnxq.do')
        let termCode = termRes.data.datas.dqxnxq.rows[0].DM

        // 获取原始的考试安排数据
        let examData = await this.post('http://ehall.seu.edu.cn/jwapp/sys/studentWdksapApp/modules/wdksap/wdksap.do', 
                                      {XNXQDM: termCode,
                                      '*order':' -KSRQ,-KSSJMS'})
        examData = examData.data.datas.wdksap.rows
        let examList = examData.map( k => {
          // 分析时间
          try{
            let rawTime = k.KSSJMS
            rawTime = rawTime.split('(')[0]
            let date = rawTime.split(' ')[0]
            let [startTime, endTime] = rawTime.split(' ')[1].split('-')
            startTime = +moment(date+'-'+startTime, 'YYYY-MM-DD-HH:mm')
            endTime = +moment(date+'-'+endTime, 'YYYY-MM-DD-HH:mm')
            duration = (endTime - startTime) / 1000 / 60
            try {
              if ( k.KSMC.split(' ')[1] ) {
                k.KCM = k.KCM + ' ' + k.KSMC.split(' ')[1]
              }
            } catch(e) {
              console.log(e)
              throw e
            }
            return {
              startTime,endTime,duration,
              semester:k.XNXQDM,
              campus:'-',
              courseName:k.KCM,
              courseType:k.KSMC,
              teacherName:k.ZJJSXM,
              location:k.JASMC
            }
          } catch(e) {
            console.log(k)
          }
        })
        examList.sort( (a, b) => {
          return a.startTime - b.startTime
        })
        this.logMsg = `${name} (${cardnum}) - 查询 2018 级考试安排`
        let finalList = []
        examList.forEach(element => {
          if(element){
            finalList.push(element)
          }
        });
        return finalList.filter(k => k.endTime > now)
      }

      await this.useAuthCookie()
      // 经测试，使用老门户的 cookie，并不需要再登录教务处。
      res = await this.get(
        'http://xk.urp.seu.edu.cn/studentService/cs/stuServe/runQueryExamPlanAction.action'
      )

      let $ = cheerio.load(res.data)
      

      this.logMsg = `${name} (${cardnum}) - 查询考试安排`
      return $('#table2 tr').toArray().slice(1).map(tr => {
        let [semester, campus, courseName, courseType, teacherName, time, location, duration]
          = $(tr).find('td').toArray().slice(1).map(td => $(td).text().trim())

        let startMoment = moment(time, 'YYYY-MM-DD HH:mm(dddd)')
        let startTime = +startMoment
        let endTime = +startMoment.add(duration, 'minutes')

        return {semester, campus, courseName, courseType, teacherName, startTime, endTime, location, duration}
      }).filter(k => k.endTime > now) // 防止个别考生考试开始了还没找到考场🤔
    })
    let result = []
    cacheResult.forEach(k => {
      if(k){
        result.push(k)
      }
    })
    return result
  
  }


}
