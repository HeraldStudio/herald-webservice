const cheerio = require('cheerio')

exports.route = {
  /**
  * GET /api/reservation/user
  * 查询用户id
  * @apiParam cardnum
  **/
  async get({ cardnums }){
    await this.useAuthCookie()

    let userIds = await Promise.all(await cardnums.split(' ').map(async cardnum => {
      let res = await this.post('http://yuyue.seu.edu.cn/eduplus/order/order/searchUser.do?sclId=1', 'cardNo='+cardnum)
      return res.data[0].userId
    }))

    
    return userIds
  }
}