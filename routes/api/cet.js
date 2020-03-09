const oracledb = require('oracledb')
exports.route = {

  /**
    * GET /api/cet
    * 个人考试信息查询
    **/

  async get() {
    const { cardnum } = this.user
    let record = await this.db.execute(
      `select H_CET.CET_EXAM_CODE, LOCATION, EXAMTIME from TOMMY.H_CET
      where CARDNUM= :cardnum
      `, [cardnum])
    let result
    if (record.rows.length === 0) {
      result = '暂无记录'
    } else {
      result = {
        examCode: record.rows[0][0],
        location: record.rows[0][1] === '' ? null : record.rows[0][1],
        examTime: record.rows[0][2] === 0 ? null : record.rows[0][2]
      }
      for (let e in result) {
        if (result[e] === null)
          delete result[e]
      }
    }
    return result
  },
  async post({ examCode, location, examTime }) {
    let { cardnum } = this.user
    if (!examCode) {
      throw '准考证号未定义'
    }
    await this.db.execute(`
    DELETE from TOMMY.H_CET
    where CARDNUM= :cardnum
    `, { cardnum })
    let sql, binds, options, result
    sql = `INSERT INTO H_CET VALUES (sys_guid(), :1, :2, :3, :4)`
    binds = [
      [cardnum, examCode, (examTime ? examTime : -1), (location ? location : '')],
    ]

    options = {
      autoCommit: true,

      bindDefs: [

        { type: oracledb.STRING, maxSize: 20 },
        { type: oracledb.STRING, maxSize: 60 },
        { type: oracledb.NUMBER },
        { type: oracledb.STRING, maxSize: 20 },
      ]
    }

    result = await this.db.executeMany(sql, binds, options)

    if (result.rowsAffected > 0) {
      return '上传CET准考证号成功'
    } else {
      throw '上传失败'
    }
  },
}
