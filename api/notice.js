const db = require('../database/publicity')

exports.route = {
  async get () {
    let schoolnum = this.user.isLogin ? this.user.schoolnum : ''
    return (await db.notice.find()).filter(k =>
      schoolnum.indexOf(k.schoolnumPrefix) === 0 ||
      !schoolnum && k.schoolnumPrefix === 'guest' ||
      schoolnum && k.schoolnumPrefix === '!guest'
    ).sort((a, b) => b.nid - a.nid)
  }
}
