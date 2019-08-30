const qiniu = require('../../sdk/qiniu')

exports.route = {
  async get({prefix}) {
    return qiniu.getUptoken(prefix)
  }
}
