const cv = require('node-opencv')

exports.route = {

  /**
   * GET /api/gpa
   * 成绩查询
   **/
  async get() {
    let { cardnum, password } = this.user
    let res = await this.get('http://xk.urp.seu.edu.cn/studentService/getCheckCode', {
      responseType: 'arraybuffer'
    })
    if (res.status >= 400) {
      this.throw(res.status)
      return
    }
    let cookie = res.headers['set-cookie']
    if (Array.isArray(cookie)) {
      cookie = cookie[0]
    }
    // TODO 验证码识别
    let verifyCode = await ...
  }
}
