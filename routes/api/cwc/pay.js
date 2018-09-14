const cheerio = require('cheerio')
const tough = require('tough-cookie')
const qs = require('querystring')

// TODO：需要日志

exports.route = {

  async get() {
    throw 'POST ONLY'
  },

  /**
  * 
  * POST /api/cwc/pay
  * 获取付款二维码链接
  * @apiParam Cookie 登录 caiwuchu.seu.edu.cn 获取的 JSESSION
  * @apiParam items 在 /api/cwc/detail 待支付列表的基础上，对本次需要支付的项目设置 checked=true
  * 
  * 根据/api/cwc/auth获取的cookie和items列表获取支付链接
  * items结构由caiwuchu.seu.edu.cn决定，参看小程序内部实现和请求1的处理过程
  * 处理成功获取的链接是一个付款二维码，可以用于小程序webview或者web iframe展示
  *
  **/
  async post({ Cookie, items }) {
    let headers = {
      Cookie,
      Origin: 'http://caiwuchu.seu.edu.cn',
      Connection: 'keep-alive',
      'Upgrade-Insecure-Requests': 1,
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.0 Safari/605.1.15'
    }

    // 请求1:到 http://caiwuchu.seu.edu.cn/payment/pay/userfee_submitBill.action 的请求
    let body = {
      feeitemdefords: [],
      ords: [],
      sysid: items[0].sysid,
      billamts: [],
      feeTotal: 0,
      type: "",
      counts: [],
      feeamts: [],
      unpaid: [],
      feeyear: [],
      feeitemordall: [],
      userid: items[0].userid
    }
    let feeTotal = 0
    items.forEach(k => {
      body.feeyear.push(k.feeord)
      body.feeitemordall.push(k.feeitemdeford)
      if (k.checked) {
        body.feeitemdefords.push(k.feeitemdeford)
        body.ords.push(k.feeord)
        body.billamts.push(k.payamt)
        feeTotal += parseFloat(k.payamt)
        body.counts.push(k.count)
        body.feeamts.push(k.feeamt)
        body.unpaid.push(k.payamt)
      }
    })
    body.feeTotal = feeTotal
    Object.keys(body).forEach(k => {
      if (typeof (body[k]) === 'object') {
        body[k] = body[k].join(',')
      }
    })
    let res = await this.post('http://caiwuchu.seu.edu.cn/payment/pay/userfee_submitBill.action', qs.stringify(body), { headers })
    let result = res.data

    if (result.split('&')[0] !== 'success') {
      throw '请求1-出现错误'
    }

    // 请求2:到 http://caiwuchu.seu.edu.cn/payment/pay/payment_selBank.action 的请求
    let billno = result.split('&')[1].split(',')[0]
    let query = {
      'billinfo.billno': result.split('&')[1].split(',')[0],
      'billdate': result.split('&')[1].split(',')[1],
      'billinfo.billamt': result.split('&')[1].split(',')[2],
      'type': '',
      'cancollection': 'F',
      'cansaving': 'false',
      'feeitemdefords': body.feeitemdefords,
      'ords': body.ords,
      'isbankrole': 'JSJF',
      'jfbFlag': undefined
    }
    let url2 = 'http://caiwuchu.seu.edu.cn/payment/pay/payment_selBank.action?' + qs.stringify(query).replace(/%3A/g, ':')
    let res2 = await this.get('http://caiwuchu.seu.edu.cn/payment/pay/payment_selBank.action?' + qs.stringify(query).replace(/%3A/g, ':'), { headers })

    // 请求3:到 http://caiwuchu.seu.edu.cn/payment/pay/payment_CheckBillno.action 的请求
    headers['Host'] = 'caiwuchu.seu.edu.cn'
    headers['Connection'] = 'keep-alive'
    headers['Origin'] = 'http://caiwuchu.seu.edu.cn'
    headers['Upgrade-Insecure-Requests'] = '1'
    let body3 = {
      billno,
      bankid: 'JZJF'
    }
    await this.post('http://caiwuchu.seu.edu.cn/payment/pay/payment_CheckBillno.action', qs.stringify(body3), { headers })

    // 请求4:到 http://caiwuchu.seu.edu.cn/payment/ToBank.jsp 的请求
    // 该请求由请求2得到的页面发起，需要获取数据
    // 金智烂代码警告
    let $ = cheerio.load(res2.data)
    let body4
    let bankid = "JZJF"
    if ($("#paystyle").val() == "O") {
      let savingAmt = $("#savingAmt").val();
      if (savingAmt.trim() == '' || parseFloat(savingAmt) == 0) {
        let userid = $("#useridHidden").val();
        let hassubbank = $("#" + bankid).val();
        let type = 'nothing';
        let subbankid = $("input[name='" + bankid + "id']:checked").val();
        let cfcabankid = $("input[name='cfcabankid']:checked").val();

        body4 = {
          billno: $("#billnoTd").text().trim(),
          bankid: bankid,
          feeitemdefords: $("#feeitemdefordsHidden").val(),
          ords: $("#ordsHidden").val(),
          ticketTitle: encodeURI($("#ticketTitle").val()),
          type: type,
          nothing: "nodate",
          alipaybankid: subbankid,
          cfcabankid: cfcabankid,
          subbankid: subbankid,
          userid: $("#useridHidden").val(),
          username: $("#usernameHidden").val(),
          url: url2,
          payamt: $("#amtTd").text(),
          domain: 'caiwuchu.seu.edu.cn'
        }
      }
    }
    let res4 = await this.post('http://caiwuchu.seu.edu.cn/payment/ToBank.jsp', qs.stringify(body4), { headers })

    // 请求5:到http://caiwuchu.seu.edu.cn/payment/pay/payment_ebankPay.action的请求
    $ = cheerio.load(res4.data)
    let body5 = {
      billno: $('#billno').val(),
      bankid: $('#bankid').val(),
      feeitemdefords: $('#feeitemdefords').val(),
      ords: $('#ords').val(),
      ticketTitle: $('#ticketTitle').val(),
      nothing: 'nodate'
    }
    let res5 = await this.post('http://caiwuchu.seu.edu.cn/payment/pay/payment_ebankPay.action', qs.stringify(body5), { headers })

    // 请求6:到http://payment.seu.edu.cn/pay/itemDeal3.html的请求
    $ = cheerio.load(res5.data)
    let body6 = {}
    let keys6 = ['sign', 'sysId', 'itemId', 'objId', 'otherId', 'objName', 'specialValue', 'returnURL', 'amount', 'returnType']
    keys6.forEach(k => {
      body6[k] = $(`#${k}`).val()
    })
    let headers6 = {
      Origin: 'http://caiwuchu.seu.edu.cn',
      Connection: 'keep-alive',
      'Upgrade-Insecure-Requests': 1,
      Referer: 'http://caiwuchu.seu.edu.cn/payment/pay/payment_ebankPay.action',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.0 Safari/605.1.15'
    }
    let res6 = await this.post('http://payment.seu.edu.cn/pay/itemDeal3.html', qs.stringify(body6), { headers: headers6 })
    // 到此为止，请求结束，从res6中获取密码
    let pwd = /\{"pwd":"([0-9A-Z]+)"\}/im.exec(res6.data)[1]

    // 该链接不需要cookie也可以正常完成支付
    return `http://payment.seu.edu.cn/pay/deal_CCB_union.html?autoSubmit=Y&realPay=1&pwd=${pwd}`

    // // 请求7:到http://payment.seu.edu.cn/pay/deal_CCB_union.html?autoSubmit=Y&realPay=1&pwd=${pwd}的请求
    // let res7 = await this.get(`http://payment.seu.edu.cn/pay/deal_CCB_union.html?autoSubmit=Y&realPay=1&pwd=${pwd}`)
    // console.log(res7)

    // // 请求8:到http://payment.seu.edu.cn/pay/log_startPay.html?___dataType=data的请求
    // let body8 = {
    //     pay_thirdPartyName:'CCB',
    //     pay_id:/"rIdExt":"([0-9]+)"/im.exec(res7.data)[1],
    //     pay_actionURL: 'https://ibsbjstar.ccb.com.cn/CCBIS/ccbMain?CCB_IBSVersion=V6',
    //     pay_realURL: 'https://ibsbjstar.ccb.com.cn/CCBIS/ccbMain?CCB_IBSVersion=V6',
    //     MAC:/"MAC":"([0-9a-z]+)"/im.exec(res7.data)[1],
    //     TIMEOUT:"",
    //     PAYMENT:/"PAYMENT":"([0-9.]+)"/im.exec(res7.data)[1],
    //     REFERER:"payment.seu.edu.cn",
    //     POSID:/"POSID":"([0-9]+)"/im.exec(res7.data)[1],
    //     RETURNTYPE:"2",
    //     ORDERID:/"ORDERID":"([0-9a-zA-Z_]+)"/im.exec(res7.data)[1],
    //     MERCHANTID:/"MERCHANTID":"([0-9]+)"/im.exec(res7.data)[1],
    //     CURCODE:/"CURCODE":"([0-9.]+)"/im.exec(res7.data)[1],
    //     TXCODE:/"TXCODE":"([0-9.]+)"/im.exec(res7.data)[1],
    //     REMARK2:"",
    //     BRANCHID:/"BRANCHID":"([0-9.]+)"/im.exec(res7.data)[1],
    //     REMARK1:/"REMARK1":"([0-9]+)\\\//im.exec(res7.data)[1]+"/"+body.userid
    // }
    // await this.post('http://payment.seu.edu.cn/pay/log_startPay.html?___dataType=data', qs.stringify(body8))


    // // 请求9:到建设银行的请求开始了
    // let body9 = {
    //     MAC:/"MAC":"([0-9a-z]+)"/im.exec(res7.data)[1],
    //     TIMEOUT:"",
    //     PAYMENT:/"PAYMENT":"([0-9.]+)"/im.exec(res7.data)[1],
    //     REFERER:"payment.seu.edu.cn",
    //     POSID:/"POSID":"([0-9]+)"/im.exec(res7.data)[1],
    //     RETURNTYPE:"2",
    //     ORDERID:/"ORDERID":"([0-9a-zA-Z_]+)"/im.exec(res7.data)[1],
    //     MERCHANTID:/"MERCHANTID":"([0-9]+)"/im.exec(res7.data)[1],
    //     CURCODE:/"CURCODE":"([0-9.]+)"/im.exec(res7.data)[1],
    //     TXCODE:/"TXCODE":"([0-9.]+)"/im.exec(res7.data)[1],
    //     REMARK2:"",
    //     BRANCHID:/"BRANCHID":"([0-9.]+)"/im.exec(res7.data)[1],
    //     REMARK1:/"REMARK1":"([0-9]+)\\\//im.exec(res7.data)[1]+"/"+body.userid
    // }
    // let res9 = await this.post('https://ibsbjstar.ccb.com.cn/CCBIS/ccbMain?CCB_IBSVersion=V6', qs.stringify(body8))

    // //请求10:到建设银行的请求2
    // let url10 = /name="jhform" action='(.*?)'/im.exec(res9.data)[1]
    // await this.post(url10)

    // let payUrl = url10
    // return payUrl
  }
}
