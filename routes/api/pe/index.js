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

// const en2ch = {
//   '男': {
//     score: '总分',
//     sex: '性别',
//     stature: '身高',
//     avoirdupois: '体重',
//     vitalCapacity: '肺活量',
//     fiftyMeter: '50米',
//     standingLongJump: '立定跳远',
//     BMI: 'BMI',
//     bend: '坐体前屈',
//     kiloMeter: '1000米',
//     lie: '引体向上'
//   },
//   '女': {
//     score: '总分',
//     sex: '性别',
//     stature: '身高',
//     avoirdupois: '体重',
//     vitalCapacity: '肺活量',
//     fiftyMeter: '50米',
//     standingLongJump: '立定跳远',
//     BMI: 'BMI',
//     bend: '坐体前屈',
//     kiloMeter: '800米',
//     lie: '仰卧起坐'
//   },
// }
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

    const now = +moment()

    const health = []
    let res = (await axios({
      url: `${peConfig.pe.url}/fitness/test/final/get-by-sutdent`,
      method: 'post',
      data: {
        "schoolYear": this.term.currentTerm.name.split('-')[0],
        "studentNo": this.user.cardnum
      }
    })).data
    for (let item of res.data) {
      if (!item.itemName) {
        item.itemName = "总分"
      }
      health.push({
        name: item.itemName,
        value: item.testRawValue + " " + (item.itemName != "1000米跑" && item.itemUnit || ""),
        score: item.testScore,
        grade: item.testLevelDesc
      })
    }

    // 获取跑操数据
    res = (await axios({
      url: `${peConfig.pe.url}/exercise/morning/attendance/get-by-student`,
      method: 'post',
      data: {
        "schoolYear": this.term.currentTerm.name.split('-')[0],
        "studentNo": this.user.cardnum
      }
    })).data.data.map(item => +moment(item.recordTime))


    res = [...new Set(res)]

    // 过滤，仅获取当前学期的的跑操次数
    res = res
      .map(k => +k)
      .filter(
        k => +moment(k) > this.term.currentTerm.startDate && +moment(k) < this.term.currentTerm.endDate
      )


    const count = res.length

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

    return { count, detail: res, health, remainDays, hint }

  }
}
