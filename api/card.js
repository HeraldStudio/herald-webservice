const cheerio = require('cheerio')
const iconv = require('iconv-lite')
const qs = require('querystring')

exports.route = {

  /**
   * GET /api/card
   * 一卡通信息及流水查询
   * @apiParam date     查询日期，格式 yyyy-M-d，不填为当日流水（带日期不能查当日流水）
   * @apiParam page     页码，不填为首页
   **/
  async get() {

    this.useAuthCookie()

    // 带着统一身份认证 Cookie 获取一卡通中心 Cookie；带着一卡通中心 Cookie 抓取一卡通页面
    await this.get('http://allinonecard.seu.edu.cn/ecard/dongnanportalHome.action')
    let res = await this.get('http://allinonecard.seu.edu.cn/accountcardUser.action')

    // 一卡通基本信息

    // 模板应用器
    function applyTemplate(template, pairs) {
      for (key in template) {
        if (template.hasOwnProperty(key)) {
          if (typeof template[key] === 'string') {
            template[key] = pairs.filter(pair => pair[0].trim() === template[key].trim())[0]
            if (template[key]) {
              template[key] = template[key][1]
            }
          } else if (typeof template[key] === 'object') {
            applyTemplate(template[key], pairs)
          }
        }
      }
    }

    // 匹配的模式串
    const columnReg = /[\r\n]([^：\r\n])+：[\s]*([^：]+)(?=[\r\n])/img

    // 返回数据的模板，键值要跟网页中找到的栏目名一致，比如「帐号」不能写成「账号」
    let info = {
      name: '姓名',
      account: '帐号',
      gender: '性别',
      cardnum: '学工号',
      identity: '身份类型',
      id: '证件号码',
      college: '所属部门',
      status: {
        mainStatus: '卡状态',
        freezeStatus: '冻结状态',
        checkStatus: '检查状态'
      },
      balance: '余额',
    }

    // 直接转文字，根据冒号分隔的固定模式匹配字段名和内容
    let $ = cheerio.load(res.data)
    let pairs = $('.neiwen').text().match(columnReg)
      .map(k => k.replace(/\s+/g, '').split('：', 2))
      .filter(k => k.length === 2)

    // 将对应的 [字段名, 内容] 二元组列表传入 applyTemplate 工具函数，替换 template 中对应键值
    applyTemplate(info, pairs)

    // 抓取余额
    let balance = /([.,\d]+)元\s*[（(]卡余额[)）]/img.exec(info.balance)[1]

    // 接口设计规范，能转换为数字/bool的数据尽量转换，不要都用字符串
    info.balance = parseFloat(balance.replace(/,/g, ''))

    // 一卡通
    let date = this.params.date || '' // 格式 yyyy-M-d
    let page = this.params.page || 1

    // 当天流水，直接查询
    if (date === '') {
      res = await this.post(
        'http://allinonecard.seu.edu.cn/accounttodatTrjnObject.action',
        {
          'pageVo.pageNum': page,
          account: info.account,
          inputObject: 'all'
        }
      )

    } else {
      // 转换成 yyyyMMdd 的格式
      date = date.split('-').map(k => parseInt(k)).reduce((a, b) => a * 100 + b, 0)

      // 四个地址要按顺序请求，前两个地址用于服务端跳转判定，不请求会导致服务端判定不通过；
      // 第三个地址只能查询第一页，无论 pageNum 值为多少，都只返回第一页；第四个地址可以查询任意页。
      for (let address of [
        'accounthisTrjn1.action',
        'accounthisTrjn2.action',
        'accounthisTrjn3.action',
        'accountconsubBrows.action'
      ]) {
        // 真正要的是最后一个接口的数据
        res = await this.post(
          'http://allinonecard.seu.edu.cn/' + address,
          {
            pageNum: page,
            account: info.account,
            inputObject: 'all',
            inputStartDate: date,
            inputEndDate: date
          }
        )
      }
    }

    // 直接上 jQuery
    $ = cheerio.load(res.data)

    let rows = []
    $('#tables').children('tbody').children('tr').each((i, tr) => {
      let cells = []
      $(tr).children('td').each((i, td) => {
        cells.push($(td).text().trim())
      })

      // 接口设计规范，一定是数字的字段尽量转成数字；表示日期时间的字段转成毫秒时间戳
      if (cells.length >= 10) rows.push({
        id: parseInt(cells[7]),
        type: cells[3],
        place: cells[4],
        time: new Date(cells[0]).getTime(),
        amount: parseFloat(cells[5].replace(/,/g, '')),
        balance: parseFloat(cells[6].replace(/,/g, '')),
        state: cells[8],
        comment: cells[9]
      })
    })

    return {
      info,
      detail: rows.slice(1, -1), // 去掉首尾项
      pageCount: parseInt(/共(\d+)页/.exec(res.data)[1]) // 返回总页数
    }
  },

  /**
   * PUT /api/card
   * 一卡通在线预充值
   * @apiParam password    充值金额，浮点数兼容
   * @apiParam amount    充值金额，浮点数兼容
   * @apiParam eacc    为1时充值到电子钱包
   **/
  async put() {
    let { password, amount, eacc } = this.params
    let { cardnum } = this.user

    let res = await this.post('http://58.192.115.47:8088/wechat-web/login/dologin.html', {
      cardno: cardnum, pwd: password
    })

    if (/账户密码错误/.test(res.data)) {
      throw '密码错误，请重试'
    }

    let cardid = /&sum=(\d{6})"/.exec(res.data)[1]
    res = await this.get(
      'http://58.192.115.47:8088/WechatEcardInterfaces/wechatweb/chongzhi.html?jsoncallback=' +
      `&value=${amount},${password}&cardno=${cardid}&acctype=${eacc === '1' ? '000' : '1'}`
    )

    let msg = JSON.parse(/callJson\s*\(\s*(\{[\s\S]*\})\s*\)/im.exec(res.data)[1]).errmsg.replace(/转账/g, '充值')
    if (/成功/.test(msg)) {
      return msg
    } else {
      throw msg
    }
  }
}
