const oracledb = require('oracledb')
exports.route = {

  /**
    * GET /api/cet
    * 个人考试信息查询
    **/

  async get() {
    return await this.userCache('1d+', async () => {
      const { cardnum } = this.user
      let record = await this.db.execute(
        `select H_CET.CET_EXAM_CODE from TOMMY.H_CET
      where CARDNUM= :cardnum
      `, [cardnum])
      let result
      if (record.rows.length === 0) {
        result = '暂无记录'
      } else {
        result = {
          examCode: record.rows[0].CET_EXAM_CODE,
          location: record.rows[0].location === '' ? null : record.rows[0].location,
          examTime: record.rows[0].examTime === 0 ? null : record.rows[0].examTime
        }
        for (let e in result) {
          if (result[e] === null)
            delete result[e]
        }
      }
      return result
    })
    // let cetCollection = await mongodb('herald_cet')
    // return await this.userCache('10h', async () => {
    //   let {  cardnum } = this.user
    //   try {
    //     await this.useEHallAuth('5226570836424975')
    //     let res = await this.post('http://ehall.seu.edu.cn/publicapp/sys/sljzkzdy/modules/ksxxhd/T_KSBM_ZKZDY_QUERY.do', { XH: cardnum })
    //     if (res.data && res.data.datas.T_KSBM_ZKZDY_QUERY.rows && res.data.datas.T_KSBM_ZKZDY_QUERY.rows[0]) {
    //       // 存在查询信息，更新数据库记录
    //       await cetCollection.deleteMany({ cardnum })
    //       let cetInfo = res.data.datas.T_KSBM_ZKZDY_QUERY.rows[0]
    //       let { ZKZH: ticketNo, KSSJ: examTime, KSDD: location, KCH: roomNo,
    //         ZWH: seatNo, KSXM_DISPLAY: examType } = cetInfo
    //       examTime = +moment(examTime, 'YYYY年M月D日hh点mm分')
    //       cetInfo = { cardnum, ticketNo, examTime, location, roomNo, seatNo, examType }
    //       await cetCollection.insertOne(cetInfo)
    //       return cetInfo
    //     } else {
    //       throw '无法查询'
    //     }
    //   } catch (e) {
    //     // 官网不存在，从数据库查询
    //     let cetInfo = await cetCollection.findOne({ cardnum })
    //     if (cetInfo) {
    //       cetInfo.store = true
    //       return cetInfo
    //     }
    //     // 数据库没有
    //     throw '没有CET考试信息'
    //   }
    // })
  },
  async post({ examCode, location, examTime }) {
    let { cardnum } = this.user
    if (!examCode) {
      throw '准考证号未定义'
    }
    await this.db.execute(`
    DELETE from TOMMY.H_CET
    where CARDNUM= :cardnum
    `)
    let sql, binds, options, result
    sql = `INSERT INTO H_CET VALUES (sys_guid(), :1, :2, :3, :4)`

    binds = [
      [cardnum, examCode, examTime ? examTime : -1, location ? location : ''],
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
