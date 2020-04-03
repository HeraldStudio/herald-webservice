const Lecture = require('../../sdk/sdk.json')['Lecture']
const moment = require('moment')

exports.route = {
  /**
  * @api {GET} /api/lecture 人文讲座信息查询
  * @apiParam {String} lecture
  */
  async get() {
    /**
        * GET /api/lecture
        * 人文讲座信息查询
        **/
    return await this.userCache('10m+', async () => {
      let query = {
        'cardnum': '' + this.user.cardnum,
        'name': this.user.name,
        'service': Lecture['service'],
        'accessKey': Lecture['accessKey']
      }
      let result = []
      let rawResult = await this.post('https://lecture.myseu.cn/api/query', JSON.stringify(query), { headers: { 'Content-Type': 'application/json' } })
      // console.log(JSON.parse(rawResult.data.toString()))
      JSON.parse(rawResult.data.toString()).result.forEach(k => {
        result.push(
          {
            'location': k['location'],
            'time': moment(k['dateStr'], 'YYYY-MM-DD').valueOf() + (18 * 60 + 30) * 60 * 1000,
            'lectureTitle': k['lectureTitle'],
            'lectureUrl': k['lectureUrl']
          }
        )
      })
      // 前端要求，除去值为null的字段
      result.forEach(Element => {
        for (let e in Element) {
          if (Element[e] === null)
            delete Element[e]
        }
      })
      return result
    })
  }
}