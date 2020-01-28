
exports.route = {
  async get({ key, type }) {
    let record = await this.db.execute(`
      SELECT *
      FROM herald_lost_and_found
      where isAudit = 1 and isFinished = 0 and type = '${type}' and title like '%${key}%'
      ORDER BY LASTMODIFIEDTIME DESC
    `)
    return record.rows.map(Element => {
      let [_id, creator, title, lastModifiedTime, describe, imageUrl, type, isAudit, isFinished] = Element
      return { _id, creator, title, lastModifiedTime, describe, imageUrl, type, isAudit, isFinished }
    })
  }
}