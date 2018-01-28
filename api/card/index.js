const cheerio = require('cheerio')

exports.route = {

  /**
   * GET /api/card
   * 一卡通状态
   **/
  async get() {

    // 用统一身份认证 Cookie 获取一卡通中心 Cookie
    let res = await this.get('http://allinonecard.seu.edu.cn/ecard/dongnanportalHome.action', {
      headers: { Cookie: this.cookie }
    })

    // 拼接两个 Cookie
    let cardCookie = res.headers['set-cookie']
    if (Array.isArray(cardCookie)) {
      cardCookie = cardCookie[0]
    }
    this.cookie += ';' + /(JSESSIONID=[0-9A-F]+)\s*[;$]/.exec(cardCookie)[1]

    // 这个页面是 UTF-8 的；查流水的页面是 GBK 的
    res = await this.get('http://allinonecard.seu.edu.cn/accountcardUser.action', {
      headers: { Cookie: this.cookie }
    })

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
    let template = {
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
    applyTemplate(template, pairs)

    // 抓取余额
    let balance = /([.,\d]+)元\s*[（(]卡余额[)）]/img.exec(template.balance)[1]

    // 接口设计规范，能转换为数字/bool的数据尽量转换，不要都用字符串
    template.balance = parseFloat(balance.replace(/,/g, ''))
    return template
  }
}
