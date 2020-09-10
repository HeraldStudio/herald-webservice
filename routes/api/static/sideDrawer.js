exports.route = {
  async get() {
    return {
      url: await this.db.execute(`
          SELECT *
          FROM (
            SELECT URL
            FROM H_STATIC
            WHERE LOCATION ='sideDrawer'
            order by PUBLISH_TIME desc
          )  
          WHERE ROWNUM = 1
    `).catch(err => {
        console.log(err)
        throw '数据库错误'
      }).then(record => {
        return record.rows[0][0]
      })
    }
  }
}