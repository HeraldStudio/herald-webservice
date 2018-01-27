const cheerio = require('cheerio')
const { submitForm } = require('../../util')
const headers = require('./header.json')

exports.route = {
  async get() {

    return (await submitForm('http://phylab.seu.edu.cn/plms/UserLogin.aspx?ReturnUrl=%2fplms%2fSelectLabSys#aspnetForm', {
      ctl00$cphSltMain$UserLogin1$txbUserCodeID: this.query.cardnum,
      ctl00$cphSltMain$UserLogin1$txbUserPwd: this.query.password,
      ctl00$cphSltMain$UserLogin1$rblUserType: 'Stu'
    }, headers)).data
  }
}