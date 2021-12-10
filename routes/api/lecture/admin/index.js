exports.route = {
  /**
  * @api {GET} /api/lecture/admin 获取讲座列表
  * @apiGroup lecture
  */
  async get() {
    if (!(await this.hasPermission('lecturerecord'))) {
      throw 403
    }
    let records = await this.db.execute(`
      SELECT ID, NAME, DATESTR, LOCATION, URL
      FROM H_LECTURE_HISTORY
      WHERE DELETED = 0
    `)
    return records.rows.map(result => {
      const [id, name, dateStr, location, url] = result
      return {id, name, dateStr, location, url}
    })
  },
  /**
  * @api {POST} /api/lecture/admin 新建讲座
  * @apiGroup lecture
  * 
  * @apiParam {String} name 讲座名称
  * @apiParam {String} dateStr 日期 YYYY-MM-DD
  * @apiParam {String} location 讲座位置
  * @apiParam {String} url 讲座地址
  */
  async post({name, dateStr, location, url}) {
    if (!(await this.hasPermission('lecturerecord'))) {
      throw 403
    }
    if (!(name && dateStr && location)) {
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
    // 更新lectureMap缓存
    await this.updateLectureMap(this.db)
    return '添加成功'
  },
  /**
  * @api {GET} /api/lecture/admin 获取讲座列表
  * @apiGroup lecture
  * 
  * @apiParam {String} id 讲座ID
  */
  async delete({id}) {
    if (!(await this.hasPermission('lecturerecord'))) {
      throw 403
    }
    if (!(id)) {
      throw '参数不全'
    }
    // 删除当场讲座的打卡记录
    await this.db.execute(`
      UPDATE H_LECTURE_CARDRECORD 
      SET DELETED = 1
      WHERE LECTURE_ID = :id AND DELETED = 0
    `, { id })
    // 删除讲座记录
    await this.db.execute(`
      UPDATE H_LECTURE_HISTORY
      SET DELETED = 1
      WHERE ID = :id
    `, { id })
    // 更新lectureMap缓存
    await this.updateLectureMap(this.db)
    return '删除成功'
  }
}