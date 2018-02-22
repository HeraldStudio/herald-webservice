const control = require('../../../control')

exports.route = {
  async get() {
    if (!this.admin.maintenance) {
      throw 403
    }
    return await control.pull()
  }
}
