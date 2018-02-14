const net = require('net')

exports.route = {

  /**
   * GET /api/pe
   * 跑操查询
   **/
  async get() {
    let { cardnum } = this.user

    let result = await new Promise((resolve, reject) => {
      let socket = new net.Socket()
      socket.setTimeout(2000, () => {
        socket.end()
        reject(408) // 408 将抛给外面，表示超时
      })
      socket.connect(10086, '121.248.63.146', () => {
        socket.write(`\x0087c0bb001d10fbf11874589e0ac7823f\x09${cardnum}\x00`)
      })
      socket.on('data', data => {
        socket.destroy()
        resolve(data.toString())
      })
    })

    return result.split(',').map(k => parseInt(k)).reduce((a, b) => a + b, 0)
  }
}
