const cheerio = require('cheerio')

exports.route = {

  /**
  * GET /api/wlan
  * seu-wlan 状态查询
  **/
  async get() {
    return await this.userCache('1m+', async () => {

      // 先检查可用性，不可用直接抛异常或取缓存
      this.guard('https://selfservice.seu.edu.cn/selfservice/campus_login.php')

      let { cardnum, password } = this.user
      let username = cardnum

      // 模拟登录
      await this.post(
        'https://selfservice.seu.edu.cn/selfservice/campus_login.php',
        { username, password }
      )

      // 查询使用状态
      res = await this.post(
        'https://selfservice.seu.edu.cn/selfservice/service_manage_index.php',
        { operation: 'status', item: 'web' }
      )

      // 分为状态/用量/连接/设备三个表格
      $ = cheerio.load(res.data)
      let [state, usage, connections, devices] = $('table[width="450"]').toArray()

      state = $(state).find('td').eq(1).text().trim()
      if (/正常/.test(state)) {
        state = {
          service: 'active',
          due: +moment(/[\d\-]+/.exec(state)[0])
        }
      } else if (/超流量锁定/.test(state)) {
        state = { service: 'locked' }
      } else {
        state = { service: 'inactive' }
      }

      // 解析用量
      let [used, left] = $(usage).find('tr').toArray().map(k => {
        return $(k).find('td').eq(1).text().trim()
      })
      usage = {used, left}

      // 解析连接
      connections = $(connections).find('tr').toArray().slice(2).map(k => {
        let [location, ip, mac] = $(k).find('td').toArray().map(k => $(k).text().trim())
        return {location, ip, mac}
      })

      // 解析设备
      devices = $(devices).find('tr').toArray().slice(1).map(k => {
        let [mac, location, due] = $(k).find('td').toArray().map(k => $(k).text().trim())
        due = +moment(due)
        return {location, mac, due}
      })

      // 查询余额
      let balance = await this.get(
        'https://selfservice.seu.edu.cn/selfservice/service_fee_index.php'
      )

      // 解析余额
      $ = cheerio.load(balance.data)
      balance = parseFloat($('tr.font_text td').eq(1).text().split(' ')[0])

      return {state, balance, usage, connections, devices}
    })
  },

  /**
  * POST /api/wlan
  * seu-wlan 开通/续期/解锁三合一
  * @apiParam months 要开通/续期的月数
  **/
  async post({ months = '' }) {
    let { cardnum, password } = this.user
    let username = cardnum

    // 模拟登录
    await this.post(
      'https://selfservice.seu.edu.cn/selfservice/campus_login.php',
      { username, password }
    )

    // 查询开通状态
    let res = await this.get(
      'https://selfservice.seu.edu.cn/selfservice/service_manage_index.php'
    )

    // 开通状态
    let $ = cheerio.load(res.data)
    let state = $('table[width="560"] tr').eq(1).find('td').eq(4).text().trim()
    let operation = ''
    if (/超额/.test(state)) {
      operation = 'unlock'
    } else if (/已开通/.test(state)) {
      operation = 'web_delay'
    } else {
      operation = 'web_subscribe'
    }

    // 执行开通或续期
    res = await this.post(
      'https://selfservice.seu.edu.cn/selfservice/service_manage_index.php',
      { operation, item: 'web', web_sel: months }
    )

    // 解析并微调错误文案
    let error = cheerio.load(res.data)('#error_info').prop('value')
    error = error.replace(/您/g, '你').replace(/,/g, '，').replace(/[!！]/g, '')
    return error ? {
      success: false,
      reason: error
    } : {
      success: true
    }
  },

  /**
  * PUT /api/wlan
  * seu-wlan 充值
  **/
  async put () {
    // TODO 验证码识别
  },

  /**
  * DELETE /api/wlan
  * seu-wlan IP下线/免认证设备删除
  * @apiParam ip   要下线的IP地址
  * @apiParam mac  要删除的设备MAC地址
  **/
  async delete ({ ip, mac }) {
    let operation = ip ? 'offline' : 'deletemacbind'

    // 执行下线或删除设备
    res = await this.post(
      'https://selfservice.seu.edu.cn/selfservice/service_manage_status_web.php',
      { operation, kick_ip_address: ip, macaddress: mac }
    )

    // 解析并微调错误文案
    let error = cheerio.load(res.data)('#error_info').prop('value')
    error = error.replace(/您/g, '你').replace(/,/g, '，').replace(/[!！]/g, '')
    return error ? {
      success: false,
      reason: error
    } : {
      success: true
    }
  }
}
