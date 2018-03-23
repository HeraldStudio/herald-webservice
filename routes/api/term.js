const { config } = require('../../app')

exports.route = {
  async get () {
    return await this.publicCache('1d', async () => {
      let now = new Date().getTime()
      return Object.keys(config.term).map(k => {
        let startDate = new Date(config.term[k]).getTime()
        let isShortTerm = /-1$/.test(k)
        let weeks = isShortTerm ? 18 : 4
        let endDate = startDate + weeks * 7 * 24 * 60 * 60 * 1000
        let current = startDate <= now && endDate > now
        return { name: k, startDate, endDate, current }
      }).sort((a, b) => a.startDate - b.startDate)
    })
  }
}
