exports.route = {
  /**
  * @api {GET} /api/lecture/detail 根据讲座ID获取讲座详细信息
  * @apiGroup lecture
  */
  async get({id}) {
    if (!(await this.hasPermission('lecturerecord'))) {
      throw 403
    }
    if (!id) {
      throw "参数不全"
    }
    let records = await this.db.execute(`
      SELECT NAME, DATESTR, LOCATION, URL
      FROM H_LECTURE_HISTORY
      WHERE ID = :id
    `, { id })
    return records.rows.map(result => {
      const [name, dateStr, location, url] = result
      return {name, dateStr, location, url}
    })[0]
  }
}
