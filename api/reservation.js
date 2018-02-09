const cheerio = require('cheerio')

const reservationAPI = {
  getDate: {
    url: "http://yuyue.seu.edu.cn/eduplus/phoneOrder/initOrderIndexP.do?sclId=1",
    info: "预约概览",
  },
  myOrder: {
    url: "http://yuyue.seu.edu.cn/eduplus/phoneOrder/fetchMyOrdersP.do?sclId=1",
    info: "预约记录"
  },
  cancel: {
    url: "http://yuyue.seu.edu.cn/eduplus/phoneOrder/delOrderP.do?sclId=1",
    info: "取消预约"
  },
  getOrder: {
    url: "http://yuyue.seu.edu.cn/eduplus/phoneOrder/phoneOrder/getOrderInfoP.do?sclId=1",
    info: "获取预约详情"
  },
  judgeOrder: {
    url: "http://yuyue.seu.edu.cn/eduplus/phoneOrder/judgeOrderP.do?sclId=1",
    info: "预约校验"
  },
  getPhone: {
    url: "http://yuyue.seu.edu.cn/eduplus/phoneOrder/initEditOrderP.do?sclId=1",
    info: ""
  },
  getFriendList: {
    url: "http://yuyue.seu.edu.cn/eduplus/order/order/order/order/searchUser.do?sclId=1",
    info: "获取伙伴列表"
  },
  newReservation: {
    url: "http://yuyue.seu.edu.cn/eduplus/phoneOrder/insertOredrP.do?sclId=1",
    info: "新的预约"
  },
}

exports.route = {

  /**
   * GET /api/reservation
   * 场馆预约
   **/

  async get() {
    let params = this.params
    await this.useAuthCookie()

    let user = this.user

    switch (params.method) {
      case 'getDate': {
        res = (await this.get(reservationAPI.getDate.url)).data
        retjson = {
          contant: res
        }
        break
      }
      case 'myOrder': {
        res = (await this.get(reservationAPI.myOrder.url)).data
        retjson = {
          contant: res
        }
        break
      }
      case 'cancelUrl': {
        console.log('cancelURL')
        break
      }
      case 'judgeOrder': {
        console.log('judgeOrder')
        break
      }
      case 'getPhone': {
        console.log('getPhone')
        break
      }
      case 'getFriendList': {
        console.log('getFriendList')
        break
      }
      case 'new': {
        console.log('new')
        break
      }
      default: {
      }
    }
    return retjson
  }
}
