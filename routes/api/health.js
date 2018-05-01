
exports.route = {
  async get() {
    return await this.publicCache('10m', async () => {
      const testConnection = async (url) => {
        let start = +moment()
        try { await this.get(url, { timeout: 3000 }) } catch (e) { return -1 }
        let end = +moment()
        return end - start
      }

      // 上游测试
      const tests = {
        '跑操': 'http://zccx.seu.edu.cn',
        '课表': 'http://xk.urp.seu.edu.cn/jw_service/service/lookCurriculum.action',
        '实验': 'http://phylab.seu.edu.cn/plms/UserLogin.aspx',
        '网络': 'https://selfservice.seu.edu.cn/selfservice/campus_login.php',
        'SRTP': 'http://10.1.30.98:8080/srtp2/USerPages/SRTP/Report3.aspx',
        '教务处': 'http://jwc.seu.edu.cn',
        '图书馆': 'http://www.libopac.seu.edu.cn:8080/reader/login.php',
        '老门户': 'http://myold.seu.edu.cn/login.portal',
        '新门户': 'http://my.seu.edu.cn',
        '场馆预约': 'http://yuyue.seu.edu.cn/eduplus/phoneOrder/initOrderIndexP.do',
        '成绩/考试': 'http://xk.urp.seu.edu.cn/studentService/system/showLogin.action',
        '一卡通/讲座': 'http://allinonecard.seu.edu.cn/homeLogin.action',
      }

      // 上游测试结果
      return await Promise.all(Object.keys(tests).map(async k => {
        let name = k, url = tests[k]
        let trials = Array(3).fill().map(_ => testConnection(tests[k]))
        trials = await Promise.all(trials)
        let timeout = trials.reduce((a, b) => b <= a || a == -1 ? b : a, -1)
        let health = timeout >= 0
        return { name, url, timeout, health }
      }))
    })
  }
}
