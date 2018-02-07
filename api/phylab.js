const cheerio = require('cheerio')
const loginUrl = 'http://phylab.seu.edu.cn/plms/UserLogin.aspx?ReturnUrl=%2fplms%2fSelectLabSys%2fDefault.aspx'

exports.route = {

  /**
   * GET /api/phylab
   * 物理实验查询
   **/
  async get() {
    // 要单独登陆，需要知道 card 和密码
    let { cardnum, password } = this.user
    // 先抓一下页面，得到 Cookie 和隐藏值，否则无法登陆
    let firstRes = await this.get(loginUrl)
    let $ = cheerio.load(firstRes.data)
    // 把 input 的内容都扔到 form 里
    let form = {}
    $('input').map((n, item) => {
      let i = $(item)
      form[i.attr('name')] = i.attr('value')
    })

    // 修改几个信息
    // 登陆类型设为学生
    form['ctl00$cphSltMain$UserLogin1$rblUserType'] = 'Stu'
    form['ctl00$cphSltMain$UserLogin1$txbUserCodeID'] = cardnum
    form['ctl00$cphSltMain$UserLogin1$txbUserPwd'] = password
    // 然后 post 一下就登进去了
    let res = await this.post(loginUrl, form)
    // TODO: 我现在没有实验可供查看，所以不知道接下来该怎么弄
  }
}
