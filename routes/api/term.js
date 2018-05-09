const { config } = require('../../app')

exports.route = {
  async get () {
    return await this.publicCache('1d', async () => {
      let now = +moment()
      return Object.keys(config.term).map(k => {
        let startMoment = moment(config.term[k], 'YYYY-M-D')
        let startDate = +startMoment
        let endDate = +startMoment.add(/-1$/.test(k) ? 4 : 18, 'weeks')
        let current = startDate <= now && endDate > now
        return { name: k, startDate, endDate, current }
      }).sort((a, b) => a.startDate - b.startDate)
    })
  }
}
