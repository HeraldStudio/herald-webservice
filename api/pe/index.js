const net = require('net')

exports.route = {

  /**
   * GET /api/pe
   * @apiParam cardnum  一卡通号
   * @apiParam password 统一身份认证密码
   *
   * 需要内网环境
   **/
  async get() {
    let { cardnum } = this

    let result = await new Promise((res, rej) => {
      let client = new net.Socket()
      client.setTimeout(1000, rej)
      client.connect(10086, '121.248.63.146', () => {
        client.write(`\x0087c0bb001d10fbf11874589e0ac7823f\x09${cardnum}\x00`)
      })
      client.on('data', data => {
        res(data.toString())
        client.destroy()
      })
    })

    return result.split(',').map(k => parseInt(k)).reduce((a, b) => a + b, 0)
  }
}
