const cheerio = require('cheerio')
const tough = require('tough-cookie')
const qs = require('querystring')

exports.route = {
/**
  * GET /api/cwc/pay
  * 获取登录用验证码和cookie
  **/
  async get() {
    return 'POST ONLY'
  },

  /**
  * POST /api/cwc/pay
  * 获取登录用验证码和cookie
  **/
  async post({ cookie, items }) {
    let headers = { cookie }

    // 到 http://caiwuchu.seu.edu.cn/payment/pay/userfee_submitBill.action 的请求
    let body = {
    feeitemdefords:[],
    ords:[],
    sysid:items[0].sysid,
    billamts:[],
    feeTotal:0,
    type:"",
    counts:[],
    feeamts:[],
    unpaid:[],
    feeyear:[],
    feeitemordall:[],
    userid:items[0].userid
    }
    let feeTotal = 0
    items.forEach(k => {
        body.feeyear.push(k.feeord)
        body.feeitemordall.push(k.feeitemdeford)
        if (k.checked) {
            body.feeitemdefords.push(k.feeitemdeford)
            body.ords.push(k.feeitemdeford)
            body.billamts.push(k.feeamt)
            feeTotal += parseFloat(k.feeamt)
            body.counts.push(k.count)
            body.feeamts.push(k.feeamt)
            body.unpaid.push(k.feeamt)
        }
    })
    body.feeTotal = feeTotal
    Object.keys(body).forEach(k => {
        if (typeof(body[k]) === 'object'){
            body[k] = body[k].join(',')
        }
    })
    let res = await this.post('http://caiwuchu.seu.edu.cn/payment/pay/userfee_submitBill.action', qs.stringify(body), { headers } )
    let result = res.data

    if (result.split('&')[0] !== 'success') {
        throw '请求1-出现错误'
    }

    //到 http://caiwuchu.seu.edu.cn/payment/pay/payment_selBank.action 的请求
    let query = {
        'billinfo.billno':result.split('&')[1].split(',')[0],
        'billdate':result.split('&')[1].split(',')[1],
        'billinfo.billamt':result.split('&')[1].split(',')[2],
        'type':'',
        'cancollection':'F',
        'cansaving':'false',
        'feeitemdefords':body.feeitemdefords,
        'ords':body.ords,
        'isbankrole':'JSJF',
        'jfbFlag':undefined
    }
    let res2 = await this.get('http://caiwuchu.seu.edu.cn/payment/pay/payment_selBank.action?' + qs.stringify(query), { headers })
    return res2.data
    

  }
}
