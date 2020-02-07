
exports.route = {
  async get({ key, type }) {
    let record = await this.db.execute(`
      SELECT *
      FROM H_LOST_AND_FOUND
      where isAudit = 1 and isFinished = 0 and type = '${type}' and title like '%${key}%'
      ORDER BY LASTMODIFIEDTIME DESC
    `)
    record = record.rows.map(Element => {
      let [_id, creator, title, lastModifiedTime, describe, imageUrl, type, isAudit, isFinished] = Element
      return { _id, creator, title, lastModifiedTime, describe, imageUrl, type, isAudit, isFinished }
    })
    // 前端要求，除去值为null的字段
    record.forEach(Element => {
      for (let e in Element) {
        if (Element[e] === null)
          delete Element[e]
      }
    })
    return record
  }
}