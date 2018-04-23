const cheerio = require('cheerio')
/*
args: ['参数名', ['参数名', function (k) { return 内容 }]]
其中k为外层this
*/
const reservationAPI = {
  getDate: {
    url: "http://yuyue.seu.edu.cn/eduplus/phoneOrder/initOrderIndexP.do?sclId=1",
    info: "场馆详情",
  },
  myOrder: {
    url: "http://yuyue.seu.edu.cn/eduplus/phoneOrder/fetchMyOrdersP.do?sclId=1",
    info: "预约记录"
  },
  cancel: {
    url: "http://yuyue.seu.edu.cn/eduplus/phoneOrder/delOrderP.do?sclId=1",
    info: "取消预约",
    args: ['id']
  },
  getOrder: {
    url: "http://yuyue.seu.edu.cn/eduplus/phoneOrder/phoneOrder/getOrderInfoP.do?sclId=1",
    info: "获取预约详情",
    args: ['itemId', 'dayInfo'] // dayInfo form: 2018-03-19
  },
  judgeOrder: {
    url: "http://yuyue.seu.edu.cn/eduplus/phoneOrder/judgeOrderP.do?sclId=1",
    info: "预约校验",
    args: ['itemId', 'dayInfo', 'time'] // dayInfo form: 2018-03-19
  },
  getPhone: {
    url: "http://yuyue.seu.edu.cn/eduplus/phoneOrder/initEditOrderP.do?sclId=1",
    info: "返回本人手机号"
  },
  getFriendList: {
    url: "http://yuyue.seu.edu.cn/eduplus/order/order/order/order/searchUser.do?sclId=1",
    info: "获取伙伴列表",
    method: 'post',
    args: ['cardNo']
    // args: [['cardNo', function (k) { return k.user }]]
  },
  'new': {
    url: "http://yuyue.seu.edu.cn/eduplus/phoneOrder/insertOredrP.do?sclId=1",
    info: "新的预约",
    args: ['orderVO.useMode','orderVO.useTime','orderVO.itemId','orderVO.phone','useUserIds','orderVO.remark']
    // useMode: 2
    // useTime: 2018-03-19+18:00-19:00
    // itemId: 16
    // phone
    // useUserIds: xxx (get it from api/reservation/getFriendList)
    // useUserIds: xxx
    // remark: empty (must append this param...)
  },
}

exports.route = {

  /**
  * 场馆预约
  * GET /api/reservation
  *   getDate: 获取场馆详情
  *   @Params:
  *     method='getDate'
  *   myOrder: 我的预约记录
  *   @Params:
  *     method='myOrder'
  *   getPhone: 获取本人手机号
  *   @Params:
  *     method='getPhone'
  *   getFriendList: 获取被邀请人的UserId
  *   @Params:
  *     method='getFriendList'
  *     cardNo='213150183'  // 一卡通号码即可
  *   new: 新的预约...
  **/

  // FIXME: 这里代码有些看不懂...不知道对后面维护有什么影响，大概的API文档如上所示
  async get(params) {
     // await this.useAuthCookie()
     //
     // let curMethod = reservationAPI[params.method]
     // // Bad Request
     // if (! curMethod) {
     //   throw 400
     // }
     // // 得到 args 的值
     // let args = (curMethod.args || [])
     //     .map(k => {
     //       if (Array.isArray(k) && typeof(k[1]) === 'function') {
     //         k[1] = k[1](this)
     //       } else {
     //         k = [k, params[k]]
     //       }
     //       return k
     //     })
     //
     // try {
     //   let res =
     //     await (curMethod.method === 'post'
     //       ? (this.post
     //         (curMethod.url,
     //         // 转化成 Object
     //         args.reduce((k, a) => { k[a[0]] = a[1]; return k }, {})))
     //       : (this.get(curMethod.url
     //         // 转化成 &foo=bar 的形式
     //         + args
     //           .reduce((k, a) =>
     //             k + '&' + a[0] + '=' + a[1]
     //             , ''))))
     //
     //   return res.data
     // } catch (e) {
     //   console.log(e)
     //   throw 400
     // }
  }
}
