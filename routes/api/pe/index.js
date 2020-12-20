// const cheerio = require('cheerio')
const peConfig = require('../../../sdk/sdk.json')
const axios = require('axios')
const moment = require('moment')

const hintTable = [
  '小猴提醒：起床不抓紧，跑操两行泪',      // 学期初提醒
  '小猴提醒：不错哦～要继续保持～',
  '小猴提醒：要抓紧跑操哦～',
  '小猴叹息：小猴为你的跑操感到悲哀',      // 彻底跑不完了
  '小猴祝贺：恭喜你已经完成了跑操任务🎉'   // 完成跑操任务
]

exports.route = {

  /**
  * GET /api/pe
  * 跑操查询
  * 暂时先不使用缓存
  * @Return { count, detail, health, remainDays, hint }
  **/

  /**
  * @api {GET} /api/pe 跑操查询
  * @apiGroup pe
  */
  async get() {

    if (!this.user.isLogin) {
      throw 401
    }

    const cardnum = this.user.cardnum
    const now = +moment()
    // // 测试样例
    // return {
    //   count: 0,
    //   detail: [],
    //   health: [],
    //   remainDays: Array(16 * 7).fill()
    //     // 当前学期每一天的跑操结束时间戳
    //     // 注意这里要克隆一次，不能在原对象上直接操作
    //     .map((_, i) => +(moment(this.term.currentTerm.startDate).clone().add(i, 'days').hour(7).minute(20)))
    //     // 过滤掉时间比现在晚的
    //     .filter(k => now < k)
    //     // 时间戳变为星期
    //     .map(k => moment(k).day())
    //     // 过滤掉周末
    //     .filter(k => k >= 1 && k <= 5)
    //     .length,
    //   hint: '小猴提醒：起床不抓紧，跑操两行泪'
    // }

    // 获取智迪锐系统的体测成绩
    let resFromZDR
    try {
      resFromZDR = await axios.post(peConfig['zhiDiRuiService']['UrlFitnessTest'], {
        schoolYear: this.term.currentTerm.name.slice(0, 4),
        studentNo: cardnum
      }, {
        timeout: 1000
      })
      resFromZDR = resFromZDR.data.data
    } catch (err) {
      throw 503
    }
    let health = []
    // 返回数据中, 没有itemName即为总分
    for (const recordFromZDR of resFromZDR) {
      let curRecord = {}
      if (recordFromZDR['itemName'] === undefined)
        curRecord['name'] = '总分'
      else
        curRecord['name'] = recordFromZDR['itemName']
      curRecord['value'] = recordFromZDR['testRawValue']
      if (recordFromZDR['testScore'] !== undefined)
        curRecord['score'] = recordFromZDR['testScore']
      if (recordFromZDR['testLevelDesc'] !== undefined)
        curRecord['grade'] = recordFromZDR['testLevelDesc']
      health.push(curRecord)
    }
    /* 返回的结果已经整理, 例子:
       [
         {
           'name':  '1000米跑',
           'value': '3'22\"',
           'score': '90',
           'grade': '优秀',
         }
       ]
     */
    // 获取智迪锐系统的跑操记录
    try {
      resFromZDR = await axios.post(peConfig['zhiDiRuiService']['UrlMorningExercise'], {
        schoolYear: this.term.currentTerm.name.slice(0, 4),
        studentNo: cardnum
      }, {
        timeout: 1000
      })
      resFromZDR = resFromZDR.data.data
    } catch (err) {
      throw 503
    }
    let ZDRTimestamp = resFromZDR.map(x => moment(x["recordTime"]).format("x"))

    // 已弃用
    // sb网信，windows server访问不了内网，所以把跑操查询服务代码在这儿重复一遍
    /* let resFromOther
    try {
      const signatureForReq = sha(`ak=${peConfig.pe.otherService.ak}&cardnum=${cardnum}&nounce=tyx&sk=${peConfig.pe.otherService.sk}`)
      resFromOther = await axios.get(peConfig.pe.otherService.url, {
        params: {
          signature: signatureForReq,
          cardnum,
          nounce: 'tyx',
          ak: peConfig.pe.otherService.ak
        },
        timeout: 1000
      })
      resFromOther = resFromOther.data
      resFromOther.records = resFromOther.records.map(time => +moment(time))
    } catch (err) {
      console.log(err)
      throw '请求跑操数据出错'
    }
    let trueRecords = {}
    resFromOther.records.forEach(time => {
      if (!trueRecords[time]) {
        trueRecords[time] = true
      }
    })
    res.data.records = res.data.records.concat(Object.keys(trueRecords)) */
    // 过滤，仅获取当前学期的的跑操次数
    ZDRTimestamp = ZDRTimestamp
      .map(k => +k)
      .filter(
        k => +moment(k) > this.term.currentTerm.startDate && +moment(k) < this.term.currentTerm.endDate
      )


    const count = ZDRTimestamp.length

    // 计算跑操剩余天数
    // 默认跑操时间前16周 
    const beginOfTerm = this.term.currentTerm.startDate
    const remainDays = Array(16 * 7).fill()
      // 当前学期每一天的跑操结束时间戳
      // 注意这里要克隆一次，不能在原对象上直接操作
      .map((_, i) => +(moment(beginOfTerm).clone().add(i, 'days').hour(7).minute(20)))
      // 过滤掉时间比现在晚的
      .filter(k => now < k)
      // 时间戳变为星期
      .map(k => moment(k).day())
      // 过滤掉周末
      .filter(k => k >= 1 && k <= 5)
      .length
    // console.log(remainDays)

    let hint
    if (now < +(moment(this.term.currentTerm.startDate).add(45, 'day'))) {
      // 开学一个月之前，显示提醒用语
      hint = hintTable[0]
    } else if ((45 - count) > remainDays) {
      // 剩余天数不够了，显示悲哀用语
      hint = hintTable[3]
    } else if (count >= 45) {
      // 完成跑操任务
      hint = hintTable[4]
    } else {
      // 随机一个
      hint = hintTable[now % 2 + 1]
    }

    return { count, detail: ZDRTimestamp, health, remainDays, hint }

  }
}
