const qiniu = require('../../sdk/qiniu')

exports.route = {
  async get() {
    return qiniu.getUptoken()
  }
}
