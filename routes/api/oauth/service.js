exports.route = {
  async get() {
    let record = await this.db.execute(`
    SELECT *
    FROM H_OAUTH_SERVICE
    `)
    let result = {}
    record.rows.map(Element => {
      let [name, url, state, icon, type] = Element
      if (result[type] === undefined) {
        result[type] = []
      }
      result[type].push({name, url, state, icon})
    })
    return result
  }
}