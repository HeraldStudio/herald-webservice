const net = require('net')

exports.route = {

  /**
   * GET /api/pe
   * @apiParam cardnum  一卡通号
   * @apiParam password 统一身份认证密码
   **/
  async get() {
    let cardnum = this.query.cardnum
    let password = this.query.password || cardnum

    let client = new net.Socket()
    client.connect(10086, '223.3.65.228', () => {
      client.write(`\x0087c0bb001d10fbf11874589e0ac7823f\x09${cardnum}\x00`)
    })
    client.on('data', data => {
      console.log(data)
    })
  }
}
