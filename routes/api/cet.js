const mongodb = require('../../database/mongodb')
exports.route = {

  /**
    * GET /api/cet
    * 个人考试信息查询
    **/

  async get() {
    let cetCollection = await mongodb('herald_cet')
    return await this.userCache('10h', async () => {
      let {  cardnum } = this.user
      try {
        await this.useEHallAuth('5226570836424975')
        let res = await this.post('http://ehall.seu.edu.cn/publicapp/sys/sljzkzdy/modules/ksxxhd/T_KSBM_ZKZDY_QUERY.do', { XH: cardnum })
        if (res.data && res.data.datas.T_KSBM_ZKZDY_QUERY.rows && res.data.datas.T_KSBM_ZKZDY_QUERY.rows[0]) {
          // 存在查询信息，更新数据库记录
          await cetCollection.deleteMany({ cardnum })
          let cetInfo = res.data.datas.T_KSBM_ZKZDY_QUERY.rows[0]
          let { ZKZH: ticketNo, KSSJ: examTime, KSDD: location, KCH: roomNo,
            ZWH: seatNo, KSXM_DISPLAY: examType } = cetInfo
          examTime = +moment(examTime, 'YYYY年M月D日hh点mm分')
          cetInfo = { cardnum, ticketNo, examTime, location, roomNo, seatNo, examType }
          await cetCollection.insertOne(cetInfo)
          return cetInfo
        } else {
          throw '无法查询'
        }
      } catch (e) {
        // 官网不存在，从数据库查询
        let cetInfo = await cetCollection.findOne({ cardnum })
        if (cetInfo) {
          cetInfo.store = true
          return cetInfo
        }
        // 数据库没有
        throw '没有CET考试信息'
      }
    })
  }
}
