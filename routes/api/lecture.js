// const Lecture = require('../../sdk/sdk.json')['Lecture']
// const moment = require('moment')

exports.route = {
  async get() {
    /**
        * GET /api/lecture
        * 人文讲座信息查询
        **/
    // let query = {
    //   'cardnum': '' + this.user.cardnum,
    //   'name': this.user.name,
    //   'service': Lecture['service'],
    //   'accessKey': Lecture['accessKey']
    // }
    // let result = []
    // let rawResult = await this.post('https://lecture.myseu.cn/api/query', JSON.stringify(query), { headers: { 'Content-Type': 'application/json' } })
    // rawResult.data.result.forEach(k => {
    //   result.push(
    //     {
    //       'location': k['location'],
    //       'time': moment(k['dateStr'],'YYYY-MM-DD').valueOf() + (18 * 60 + 30)*60*1000,
    //       'lectureTitle':k['lectureTitle'],
    //       'lectureUrl':k['lectureUrl']
    //     }
    //   )
    // })
    let result = [
      { 
        'location':'信使计划工作室',
        'time':moment(),
        'lectureTitle':'查询讲座信息请安装小猴偷米App最新版本。',
        'lectureUrl':'https://mp.weixin.qq.com/s/ntWJdaCfHddMrWswTK28aQ'
      },
      { 
        'location':'信使计划工作室',
        'time':moment(),
        'lectureTitle':'点击本条或访问小猴偷米公众号可查看更新推送。',
        'lectureUrl':'https://mp.weixin.qq.com/s/ntWJdaCfHddMrWswTK28aQ'
      }
    ]
    return result
  }
}