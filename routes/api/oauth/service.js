exports.route = {
  async get({ debugEnable = 0 }) {
    let record
    if (debugEnable) {
      record = await this.db.execute(`
      SELECT *
      FROM H_OAUTH_SERVICE
      ORDER BY "order"
      `)
    } else {
      record = await this.db.execute(`
      SELECT *
      FROM H_OAUTH_SERVICE
      WHERE UNDERTEST = 0
      ORDER BY "order"
      `)
    }
    let result = {}
    record.rows.map(Element => {
      let [name, url, state, icon, type] = Element
      if (result[type] === undefined) {
        result[type] = []
      }
      result[type].push({ name, url, state, icon })
    })
    return result
  }
}