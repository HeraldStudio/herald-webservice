const cheerio = require('cheerio')

exports.route = {

  /**
  * GET /api/exam
  * 个人考试信息查询
  **/

  async get() {
    return await this.userCache('1s', async () => {

      let { name, cardnum, schoolnum } = this.user
      //console.log('{ name, cardnum, schoolnum }:'+{ name, cardnum, schoolnum })
      let now = +moment()

      // 新考试安排系统-目前使用18级本科生数据进行测试
      if (/^21318/.test(cardnum) || /^[0-9A-Z]{3}18/.test(schoolnum) || /^21319/.test(cardnum) || /^[0-9A-Z]{3}19/.test(schoolnum)) {

        await this.useEHallAuth('4768687067472349')

        // 获取学期代号
        let termCode
        try {
          let termRes = await this.post('http://ehall.seu.edu.cn/jwapp/sys/studentWdksapApp/modules/wdksap/dqxnxq.do')
          termCode = termRes.data.datas.dqxnxq.rows[0].DM
        } catch (e) {
          throw '考试查询-获取学期代号异常'
        }

        // 获取原始的考试安排数据
        let examData = await this.post('http://ehall.seu.edu.cn/jwapp/sys/studentWdksapApp/modules/wdksap/wdksap.do',
          {
            XNXQDM: termCode,
            '*order': ' -KSRQ,-KSSJMS'
          })
        examData = examData.data.datas.wdksap.rows
        let examList = examData.map(k => {
          // 分析时间
          try {
            let rawTime = k.KSSJMS
            rawTime = rawTime.split('(')[0]
            let date = rawTime.split(' ')[0]
            let [startTime, endTime] = rawTime.split(' ')[1].split('-')
            startTime = +moment(date + '-' + startTime, 'YYYY-MM-DD-HH:mm')
            endTime = +moment(date + '-' + endTime, 'YYYY-MM-DD-HH:mm')
            let duration = (endTime - startTime) / 1000 / 60
            try {
              if (k.KSMC.split(' ')[1]) {
                k.KCM = k.KCM + ' ' + k.KSMC.split(' ')[1]
              }
            } catch (e) {
              console.log(e)
              throw e
            }
            return {
              startTime, endTime, duration,
              semester: k.XNXQDM,
              campus: '-',
              courseName: k.KCM,
              courseType: k.KSMC,
              teacherName: k.ZJJSXM,
              location: k.JASMC
            }
          } catch (e) {
            console.log(k)
          }
        })
        examList.sort((a, b) => {
          return a.startTime - b.startTime
        })
        this.logMsg = `${name} (${cardnum}) - 查询 2018 级考试安排`
        let finalList = []
        examList.forEach(element => {
          if (element) {
            finalList.push(element)
          }
        })
        return finalList.filter(k => k.endTime > now)
      }

      await this.useAuthCookie()
      // 经测试，使用老门户的 cookie，并不需要再登录教务处。
      let res = await this.get(
        'http://xk.urp.seu.edu.cn/studentService/cs/stuServe/runQueryExamPlanAction.action'
      )
      //console.log('res.data:' + res.data)
      let $ = cheerio.load(res.data)

      this.logMsg = `${name} (${cardnum}) - 查询考试安排`
      let result = $('#table2 tr').toArray().slice(1).map(tr => {
        let [semester, campus, courseName, courseType, teacherName, time, location, duration]
          = $(tr).find('td').toArray().slice(1).map(td => $(td).text().trim())

        let startMoment = moment(time, 'YYYY-MM-DD HH:mm(dddd)')
        let startTime = +startMoment
        let endTime = +startMoment.add(duration, 'minutes')

        return { semester, campus, courseName, courseType, teacherName, startTime, endTime, location, duration }
      }).filter(k => k.endTime > now) // 防止个别考生考试开始了还没找到考场🤔
      //console.log('result' + result)
      // 在考试周的时候强制缓存 12月 1月
      if (result.length === 0 && (moment().format('MMM') === '12月' || moment().format('MMM') === '1月')) {
        throw '上游数据出错'
      }
      return result
    })

  }


}
