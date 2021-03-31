exports.route = {
  async get() {
    if (!(await this.hasPermission('lecturerecord'))) {
      throw 403
    }
    let records = await this.db.execute(`
      SELECT ID, NAME, DATESTR, LOCATION, URL
      FROM H_LECTURE_HISTORY
    `)
    return records.rows.map(result => {
      const [id, name, dateStr, location, url] = result
      return {id, name, dateStr, location, url}
    })
  },
  /**
  * @api {POST} /api/lectureManage 新建讲座
  * @apiGroup lectureManage
  * 
  * @apiParam {String} name 讲座名称
  * @apiParam {String} dateStr 日期 YYYY-MM-DD
  * @apiParam {String} location 讲座位置
  * @apiParam {String} url 讲座地址
  * @apiParam {String} key 包括发布者姓名，一卡通，角色，来源的密钥
  * @apiParam {String} signature 包括secretKey，发布者姓名，一卡通，角色的密钥
  */
  async post({name, dateStr, location, url}) {
    if (!(await this.hasPermission('lecturerecord'))) {
      throw 403
    }
    if (!(name && dateStr && location && url)) {
      throw '参数不全'
    }
    // 存入讲座
    await this.db.execute(`
			INSERT INTO H_LECTURE_HISTORY
			(NAME, DATESTR, LOCATION, URL)
			VALUES (:name, :dateStr, :location, :url)`,{
      name,
      dateStr,
      location,
      url
    })
    return '添加成功'
  },
  async delete({id}) {
    if (!(await this.hasPermission('lecturerecord'))) {
      throw 403
    }
    if (!(id)) {
      throw '参数不全'
    }
    await this.db.execute(`
      DELETE FROM H_LECTURE_HISTORY
      WHERE ID = :id
    `, { id })
    return '删除成功'
  }
}