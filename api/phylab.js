const cheerio = require('cheerio')
const loginUrl = 'http://phylab.seu.edu.cn/plms/UserLogin.aspx?ReturnUrl=%2fplms%2fSelectLabSys%2fDefault.aspx'

exports.route = {

  /**
   * GET /api/phylab
   * 物理实验查询
   **/
  async get() {
    let { cardnum, password } = this.user
    let firstRes = await this.get(loginUrl)
    let $ = cheerio.load(firstRes.data)
    let form = {}
    $('input').map((n, item) => {
      let i = $(item)
      form[i.attr('name')] = i.attr('value')
    })
    form['ctl00$cphSltMain$UserLogin1$rblUserType'] = 'Stu'
    form['ctl00$cphSltMain$UserLogin1$txbUserCodeID'] = cardnum
    form['ctl00$cphSltMain$UserLogin1$txbUserPwd'] = password
    let res = await this.post(loginUrl, form)
    return res.data
  }
}
