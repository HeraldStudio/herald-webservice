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

    // 请求1:到 http://caiwuchu.seu.edu.cn/payment/pay/userfee_submitBill.action 的请求
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

    // 请求2:到 http://caiwuchu.seu.edu.cn/payment/pay/payment_selBank.action 的请求
    let billno = result.split('&')[1].split(',')[0]
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
    let url2 = 'http://caiwuchu.seu.edu.cn/payment/pay/payment_selBank.action?' + qs.stringify(query)
    let res2 = await this.get('http://caiwuchu.seu.edu.cn/payment/pay/payment_selBank.action?' + qs.stringify(query), { headers })
    
    // 请求3:到 http://caiwuchu.seu.edu.cn/payment/pay/payment_CheckBillno.action 的请求
    headers['Host'] = 'caiwuchu.seu.edu.cn'
    headers['Connection'] = 'keep-alive'
    headers['Origin'] = 'http://caiwuchu.seu.edu.cn'
    headers['Upgrade-Insecure-Requests'] = '1'
    let body3 = {
        billno,
        bankid:'JZJF'
    }
    await this.post( 'http://caiwuchu.seu.edu.cn/payment/pay/payment_CheckBillno.action', qs.stringify(body3), { headers })

    // 请求4:到 http://caiwuchu.seu.edu.cn/payment/ToBank.jsp 的请求
    // 该请求由请求2得到的页面发起，需要获取数据
    // 金智烂代码警告
    let $ = cheerio.load(res2.data)
    let body4
    //let bankid = $("input[name='selbank']:checked").val();
    let bankid = "JZJF"
    if (bankid != "WEIXIN") {
        if ($("#paystyle").val() == "O"){
            let savingAmt = $("#savingAmt").val();
            if (savingAmt.trim() == '' || parseFloat(savingAmt) == 0){
                let userid=$("#useridHidden").val();
				let hassubbank = $("#" + bankid).val();
				let type="";
				let subbankid = $("input[name='" + bankid + "id']:checked").val();
				let cfcabankid = $("input[name='cfcabankid']:checked").val();
                
                if(bankid!='APAY'&&bankid!='CFCA'&&bankid!='PE'&&hassubbank=='F'){
                    type="nothing";
                }else if(bankid=='CFCA'){
                    type="cfcabankid";
                }else if(bankid=='PE'){
                    type="alipaybankid";
                }else if(hassubbank=='T'){
                    type="subbankid";
                }else{
                    type="alipaybankid";
                }

                body4 = {
                    billno:$("#billnoTd").text().trim(),
                    bankid:bankid,
                    feeitemdefords:$("#feeitemdefordsHidden").val(),
                    ords:$("#ordsHidden").val(),
                    ticketTitle:encodeURI($("#ticketTitle").val()),
                    type:type,
                    nothing:"nodate",
                    alipaybankid:subbankid,
                    cfcabankid:cfcabankid,
                    subbankid:subbankid,
                    userid:$("#useridHidden").val(),
                    username:$("#usernameHidden").val(),
                    url:url2,
                    payamt:$("#amtTd").text(),
                    domain:'caiwuchu.seu.edu.cn'
                }
            }
        }
    }
    let res4 = await this.post('http://caiwuchu.seu.edu.cn/payment/ToBank.jsp', qs.stringify(body4), {headers})
    
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
    let res5 = await this.post('http://caiwuchu.seu.edu.cn/payment/pay/payment_ebankPay.action', qs.stringify(body5), {headers})

    // 请求6:到http://payment.seu.edu.cn/pay/itemDeal3.html的请求
    $ = cheerio.load(res5.data)
    let body6 = {}
    let keys6 = ['sign', 'sysId', 'itemId', 'objId', 'otherId', 'objName', 'specialValue', 'returnURL', 'amount', 'returnType']
    keys6.forEach(k => {
        body6[k] = $(`#${k}`).val()
    })
    let res6 = await this.post('http://payment.seu.edu.cn/pay/itemDeal3.html', qs.stringify(body6))

    // 到此为止，请求结束，从res6中获取密码
    let pwd = /\{"pwd":"([0-9A-Z]+)"\}/im.exec(res6.data)[1]

    // 请求7:这个请求很重要不然付款不能到账
    await this.get(`http://payment.seu.edu.cn/pay/deal_CCB_union.html?autoSubmit=Y&realPay=1&pwd=${pwd}`)
    return { pwd }
  }
}
