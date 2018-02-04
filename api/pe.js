const net = require('net')

exports.route = {

  /**
   * GET /api/pe
   * 跑操查询
   **/
  async get() {
    let { cardnum } = this.user

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
