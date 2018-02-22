exports.route = {
  async get() {
    if (!this.admin.maintenance) {
      throw 403
    }

    const testConnection = async (url) => {
      let start = new Date().getTime()
      try { await this.get(url, { timeout: 1000 }) } catch (e) { return -1 }
      let end = new Date().getTime()
      return end - start
    }

    // 上游测试
    const tests = {
      '教务处前台': 'http://jwc.seu.edu.cn',
      '教务处教务系统': 'http://xk.urp.seu.edu.cn/studentService/system/showLogin.action',
      '教务处课表查询': 'http://xk.urp.seu.edu.cn/jw_service/service/lookCurriculum.action',
      '教务处验证码': 'https://boss.myseu.cn/jwccaptcha/',
      '老信息门户': 'http://myold.seu.edu.cn',
      '新信息门户': 'http://my.seu.edu.cn',
      '图书馆': 'http://www.libopac.seu.edu.cn:8080/reader/login.php',
      '图书馆验证码': 'https://boss.myseu.cn/libcaptcha/',
      '空教室&开学日期': 'http://58.192.114.179/classroom/common/gettermlistex',
      '一卡通中心': 'http://allinonecard.seu.edu.cn/ecard/dongnanportalHome.action',
      '体育系跑操查询': 'http://zccx.seu.edu.cn',
      '物理实验中心': 'http://phylab.seu.edu.cn/plms/UserLogin.aspx',
      '场馆预约': 'http://yuyue.seu.edu.cn/eduplus/phoneOrder/initOrderIndexP.do',
      'SRTP': 'http://10.1.30.98:8080/srtp2/USerPages/SRTP/Report3.aspx',
      '网络中心': 'https://selfservice.seu.edu.cn/selfservice/campus_login.php'
    }

    // 上游测试结果
    return await Promise.all(Object.keys(tests).map(k => (async () => {
      let name = k, url = tests[k]
      let timeout = await testConnection(tests[k])
      let health = timeout >= 0 && timeout < 1000
      return { name, url, timeout, health }
    })()))
  }
}
