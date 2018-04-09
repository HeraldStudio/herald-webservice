const db = require('../../database/publicity')

exports.route = {
  async get ({ page = 1, pagesize = 10 }) {
    return await this.publicCache('1m', async () => {
      let now = new Date().getTime()
      return (await db.activity.find())
        .sort((a, b) => b.startTime - a.startTime)
        .slice((page - 1) * pagesize, page * pagesize)
    })
  }
}
