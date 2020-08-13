const oracledb = require('oracledb')
exports.route = {
  async get() {
    return await this.userCache('1d+', async () => {
      let { cardnum } = this.user
      let record = await this.db.execute(`
      SELECT ZP
      FROM T_ZP
      WHERE XH =:cardnum
      `, { cardnum },
        {
          fetchInfo: { "ZP": { type: oracledb.BUFFER } }
        })
      return { photo: record.rows[0][0] }
    }
    )
  }
}