const mongodb = require('../../database/mongodb')
exports.route = {

  /**
    * GET /api/cet
    * 个人考试信息查询
    **/

  async get() {
    const { cardnum } = this.user
    console.log(cardnum)
    let record= await this.db.execute(
      `select H_CET.CET_EXAM_CODE from TOMMY.H_CET
    where CARDNUM= :cardnum
    `,[cardnum])

    let result = record.rows.map( Element => {
      let [CET_EXAM_CODE]=Element
      return { CET_EXAM_CODE }
    })
    
    console.log(result)
    return result

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

  async put({examcard}) {
    const { cardnum } = this.user
    console.log(cardnum)
    await this.db.execute(
      `update TOMMY.H_CET set CET_EXAM_CODE = :examcard
    where CARDNUM= :cardnum
    `,{examcard,cardnum})

    console.log("修改成功")
    return 'OK'
  }
}
