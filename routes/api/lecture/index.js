// const Lecture = require('../../sdk/sdk.json')['Lecture']
const moment = require('moment')

exports.route = {
  /**
  * @api {GET} /api/lecture 人文讲座信息查询
  * @apiGroup lecture
  */
  async get() {
    let cardnum = this.user.cardnum
    let name = this.user.name
    let rawResult = await this.db.execute(`
        SELECT CARDNUM, NAME, LOCATION, DATESTR, TIMESTAMP
        FROM H_LECTURE_CARDRECORD
        WHERE CARDNUM = :cardnum AND NAME = :name AND DELETED = 0
        GROUP BY CARDNUM, NAME, LOCATION, DATESTR, TIMESTAMP
        ORDER BY TIMESTAMP`,{
      cardnum, name
    })
    let result1 = []
    // result1 中是按照10分钟去重的记录
    rawResult.rows.forEach( r => {
      if(result1.length === 0){
        result1.push(r)
      } else {
        if(r[4] - result1[result1.length - 1][4] > 10 * 60 * 100) {
          result1.push(r)
        }
      }
    })
    let result2 = {}
    result1.forEach ( r => {
      if(!result2[r[3]]) {
        result2[r[3]] = {}
      }
      if(!result2[r[3]][r[2]]){
        result2[r[3]][r[2]] = []
      }
      if(this.lectureMap[r[3]] && this.lectureMap[r[3]][r[2]]) {
        // 如果存在当日当地讲座具体记录
        if(result2[r[3]][r[2]].length < this.lectureMap[r[3]][r[2]].length){
          // 并且当日当地的讲座记录多于当前查询人当日当地的打卡记录
          let index = result2[r[3]][r[2]].length
          let history = this.lectureMap[r[3]][r[2]][index]
          let [cardnum, name, location, dateStr, timestamp] = r
          let ret = {cardnum, name, location, dateStr, timestamp}
          ret.lectureTitle = history.name
          ret.lectureUrl = history.url
          result2[r[3]][r[2]].push(ret)
        }
      } 
      // 出现了非人文讲座的记录，所以这里注释掉，不作为有效记录 2020-12-16

      // else {
      //     // 没有当日记录则只记录一次有效记录
      //     if(result2[r.dateStr][r.location].length === 0){
      //         result2[r.dateStr][r.location].push(r)
      //     }
      // }
    })
    // 收集所有有效记录
    let result = []
    Object.keys(result2).forEach( dateStr => {
      Object.keys(result2[dateStr]).forEach( location => {
        result = result.concat(result2[dateStr][location])
      })
    })
    result.sort((a,b)=>{
      return (+moment(a.dateStr, 'YYYY-MM-DD'))-(+moment(b.dateStr, 'YYYY-MM-DD'))
    })
    // console.log(JSON.parse(rawResult.data.toString()))
    let final = []
    result.forEach(k => {
      final.push(
        {
          'location': k['location'],
          'time': moment(k['dateStr'], 'YYYY-MM-DD').valueOf() + (18 * 60 + 30) * 60 * 1000,
          'lectureTitle': k['lectureTitle'],
          'lectureUrl': k['lectureUrl']
        }
      )
    })
    // 前端要求，除去值为null的字段
    final.forEach(Element => {
      for (let e in Element) {
        if (Element[e] === null)
          delete Element[e]
      }
    })
    return final
  }
}