const cheerio = require('cheerio')
/*
args: ['参数名', ['参数名', function (k) { return 内容 }]]
其中k为外层this
*/
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
    info: "返回预约手机号"
  },
  getFriendList: {
    url: "http://yuyue.seu.edu.cn/eduplus/order/order/order/order/searchUser.do?sclId=1",
    info: "获取伙伴列表",
    method: 'post',
    args: ['cardNo']
    // FIXME 这里是不是可以由this.user得到？还是允许查别人的？
    // 是根据一卡通可以获得一个同学的信息，然后返回他的userId之类的东西
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
  * GET /api/reservation
  * method=(reservationAPI里的一个key)
  * 其它的param视乎reservationAPI[method].args决定。
  * method=getOrder 时有 itemId 和 dayInfo
  * method=getFriendList 时有 cardNo
  * 场馆预约
  **/

  async get(params) {
    // await this.useAuthCookie()

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

    //   return res.data
    // } catch (e) {
    //   console.log(e)
    //   throw 400
    // }
  }
}
