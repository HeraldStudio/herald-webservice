const cheerio = require('cheerio')

exports.route = {

  /**
  * GET /api/card
  * 一卡通信息及流水查询
  * @apiParam date     查询日期，格式 yyyy-M-d，不填为当日流水（带日期不能查当日流水）
  * @apiParam page     页码，不填为首页
  **/
  async get({ date = '' }) {
    // 懒缓存 1 分钟
    return await this.userCache('10m+', async () => {

      // 先检查可用性，不可用直接抛异常或取缓存
      this.guard('http://allinonecard.seu.edu.cn/homeLogin.action')

      await this.useAuthCookie()
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
        account: '帐号',
        status: '卡状态',
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
      let balance = /([.,\d]+)元\s*[（(]卡余额[)）]/img.exec(info.balance)[1].trim()

      // 接口设计规范，能转换为数字/bool的数据尽量转换，不要都用字符串
      info.balance = parseFloat(balance.replace(/,/g, ''))

      // 查询电子钱包余额
      res = await this.get('http://allinonecard.seu.edu.cn/accounttranUser.action')
      $ = cheerio.load(res.data)
      info.eacc = parseFloat($('tr.listbg>td').eq(2).text().trim().replace(/,/g, ''))

      // 由于此接口一次只查询一天，一般只有一到两页，遍历查询所有页对性能影响不大，且方便了接口调用，所以这里用遍历
      let page = 1, pageCount = 1, detail = []
      while (page <= pageCount) {
        if (date) {
          date = moment(date, 'YYYY-M-D')
        }

        // 当天流水，直接查询
        // 这里要判断传入日期是否是今天，如果是今天则不能用历史流水查询的方式
        if (!date || +date === +moment().startOf('day')) { 
          res = await this.post('http://allinonecard.seu.edu.cn/accounttodatTrjnObject.action',{
            'pageVo.pageNum': page,
            account: info.account,
            inputObject: 'all'
          })
        } else {
          // 转换成 YYYYMMDD 的格式
          date = date.format('YYYYMMDD')

          // 四个地址要按顺序请求，前两个地址用于服务端跳转判定，不请求会导致服务端判定不通过；
          // 第三个地址只能查询第一页，无论 pageNum 值为多少，都只返回第一页；第四个地址可以查询任意页。
          for (let address of [
            'accounthisTrjn1.action',
            'accounthisTrjn2.action',
            'accounthisTrjn3.action',
            'accountconsubBrows.action'
          ]) {
            // 真正要的是最后一个接口的数据
            res = await this.post('http://allinonecard.seu.edu.cn/' + address,{
              pageNum: page,
              account: info.account,
              inputObject: 'all',
              inputStartDate: date,
              inputEndDate: date
            })
          }
        }

        // 直接上 jQuery
        $ = cheerio.load(res.data)

        detail = detail.concat($('#tables').children('tbody').children('tr').toArray().slice(1, -1).map(tr => {
          let [time, cardnum, name, type, location, amount, balance, id, state, comment]
            = $(tr).children('td').toArray().map(td => $(td).text().trim())

          // 接口设计规范，一定是数字的字段尽量转成数字；表示日期时间的字段转成毫秒时间戳
          return {
            id: parseInt(id),
            desc: location || type.replace(/扣款/g, '') || comment.replace(/^[\d-]+/, ''), // 地点或者交易性质
            time: +moment(time, 'YYYY/MM/DD HH:mm:ss'),
            amount: parseFloat(amount.replace(/,/g, '')),
            balance: parseFloat(balance.replace(/,/g, '')),
            state: state
          }
        }))

        // 更新总页码，如果还有下一页，循环抓取下一页
        pageCount = parseInt(/共(\d+)页/.exec(res.data)[1])
        page++
      }
      let { name, cardnum, schoolnum } = this.user
      this.logMsg = `${name} (${cardnum}) - 查询一卡通流水`
      return { info, detail }
    })
  },

  /**
  * PUT /api/card
  * 一卡通在线预充值
  * @apiParam password   一卡通查询密码
  * @apiParam amount     充值金额，浮点数兼容
  * @apiParam eacc       为真值时充值到电子钱包
  **/
  async put({ cardnum, password, amount, eacc }) {
    cardnum || ({ cardnum, name } = this.user)

    let res = await this.post('http://58.192.115.47:8088/wechat-web/login/dologin.html', {
      cardno: cardnum, pwd: password
    })

    if (/账户密码错误/.test(res.data)) {
      throw '密码错误，请重试'
    }

    let cardid = /&sum=(\d{6})"/.exec(res.data)[1]
    res = await this.get(
      'http://58.192.115.47:8088/WechatEcardInterfaces/wechatweb/chongzhi.html?jsoncallback=' +
      `&value=${amount},${password}&cardno=${cardid}&acctype=${eacc ? '000' : '1'}`
    )

    let msg = JSON.parse(/callJson\s*\(\s*(\{[\s\S]*\})\s*\)/im.exec(res.data)[1]).errmsg.replace(/转账/g, '充值')
    if (/成功/.test(msg)) {
      this.logMsg = `${name} (${cardnum}) - 一卡通充值成功`
      return msg
    } else {
      throw msg
    }
  }
}
