const qiniu = require('../sdk/qiniu')

exports.route = {
  async get() {
    let uptoken = qiniu.getUptoken()
    return { uptoken }
  }
}
