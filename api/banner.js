const db = require('../database/publicity')

exports.route = {
  async get () {
    let schoolnum = this.user.isLogin ? this.user.schoolnum : ''
    let now = new Date().getTime()
    return (await db.banner.find({
      startTime: { $lte: now },
      endTime: { $gt: now }
    })).filter(k =>
      schoolnum.indexOf(k.schoolnumPrefix) === 0 ||
      !schoolnum && k.schoolnumPrefix === 'guest' ||
      schoolnum && k.schoolnumPrefix === '!guest'
    )
  }
}
