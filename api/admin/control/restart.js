const control = require('../../../control')

exports.route = {
  async get() {
    if (!this.admin.maintenance) {
      throw 403
    }
    control.restart()

    // 超管 token 重启后会变化，这里提前告知超管 token 已过期
    if (this.admin.super) {
      throw 401
    }
  }
}
