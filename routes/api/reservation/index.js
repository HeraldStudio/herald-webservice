const cheerio = require('cheerio')

/**
 * itemId item
 * 7      乒乓球 九龙湖
 * 8      篮球 九龙湖
 * 9      排球 九龙湖
 * 10     羽毛球 九龙湖
 * 11     舞蹈 九龙湖
 * 12     健身 九龙湖
 * 13     武术 九龙湖
 * 14     跆拳道 九龙湖
 * 15     羽毛球 四牌楼
 * 16     乒乓球 四牌楼
 * 17     网球场 四牌楼
 */

/**
  * dayInfo 为今天 明天 后天
  * format 2018-09-27
  */

exports.route = {

  /**
  * GET /api/reservation
  * @apiParam itemId
  * @apiParam dayInfo
  * @apiParam pageNumber
  * 预约信息查询
  **/
  async get({ itemId, dayInfo }) {
    await this.useAuthCookie()
    let res = await this.post('http://yuyue.seu.edu.cn/eduplus/order/order/getOrderInfo.do?sclId=1', {
      itemId: itemId,
      dayInfo: dayInfo,
      pageNumber: 1
    })
    let data = []
    let $ = cheerio.load(res.data)
    $('.time-item ').toArray().map(time => {
      content = $(time).text().replace(/[\n\t]/g, '').split(' ')
      //[ '', '20:00-21:00', '6', '/', '6', '', '预约' ]
      data.push({
        time: content[1],
        current_number: content[2],
        total_number: content[4],
        isAvailable: content[2] !== content[4]
      })
      //console.log($(time).text())
    })

    let page_two = await this.post('http://yuyue.seu.edu.cn/eduplus/order/order/getOrderInfo.do?sclId=1', {
      itemId: itemId,
      dayInfo: dayInfo,
      pageNumber: 2
    })
    $ = cheerio.load(page_two.data)
    $('.time-item ').toArray().map(time => {
      content = $(time).text().replace(/[\n\t]/g, '').split(' ')
      //[ '', '20:00-21:00', '6', '/', '6', '', '预约' ]
      data.push({
        time: content[1],
        current_number: content[2],
        total_number: content[4],
        isAvailable: content[2] !== content[4]
      })
      //console.log($(time).text())
    })

    return data 
  },

  /**
  * POST /api/reservation
  * @apiParam time
  * @apiParam dayInfo
  * @apiParam itemId
  * @apiParam useMode
  * @apiParam userIds
  * @apiParam phone
  * @apiParam validateCode
  * 预约场馆
  **/
  async post({ time, dayInfo, itemId, useMode, userIds, validateCode }) {
    await this.useAuthCookie()
    
    return 'ok'
    /**
 * 2018-10-01
 * 7
 * 09:00-10:00
*/
  }
}
