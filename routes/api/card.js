/*eslint no-prototype-builtins:warn,  no-unused-vars:off*/
const cheerio = require('cheerio')
const oracle = require('../../database/oracle')

exports.route = {

  /**
  * GET /api/card
  * 一卡通信息及流水查询
  * @apiParam date    查询日期，格式 YYYY-MM-DD
  **/
  async get({ date = '' }) {
    if (!date) {
      date = moment().add(-1, 'days').format('YYYY-MM-DD')
    } else if (date !== moment(date, 'YYYY-MM-DD').format('YYYY-MM-DD')) {
      throw '日期格式不合法'
    }

    const { cardnum } = this.user
    const db = await oracle.getAllinoneCardConnection()

    try {
      // 查询卡基本信息
      let record = await db.execute(`
    SELECT 
      account, cardbalance, ebagamt
    FROM
      seuecard.account
    WHERE
      sno = :cardnum
    `, { cardnum: cardnum.padEnd(20, ' ') })

      // 新中新的数据库用的是 CHAR(20) 类型，要补上11个空格，给爷爪巴
      const info = {
        account: record.rows[0][0],
        status: '-', // TODO: 哪个字段表示卡状态？
        balance: record.rows[0][1] / 100,
        // 获取不到电子钱包的余额了
      }

      // 查询指定日期的流水记录
      let getTrans = async (tableName) => {
        try {
          let record = await db.execute(`
        SELECT
            trantype,
            mercname,
            tranname,
            tranamt,
            cardbalance,
            ebagamt,
            tran_timestamp,
            tran_resume
        FROM
            (
                SELECT
                    from_record.tran_timestamp,
                    t_mercacc.mercname,
                    t_trcd.tranname,
                    tranamt,
                    cardbalance,
                    ebagamt,
                    tran_resume,
                    'FROM' trantype
                FROM
                    (
                        SELECT
                            trjn.toaccount      to_merc_account,
                            trjn.trancode       trancode,
                            trjn.jndatetime     tran_timestamp,
                            trjn.cardbalance    cardbalance,
                            trjn.tranamt        tranamt,
                            trjn.resume         tran_resume,
                            trjn.ebagamt        ebagamt
                        FROM
                        ${tableName} trjn,
                            (
                                SELECT
                                    account
                                FROM
                                    seuecard.account
                                WHERE
                                    sno = :cardnum
                            ) cardnum_to_account
                        WHERE
                                trjn.fromaccount = cardnum_to_account.account
                            AND trjn.jndatetime BETWEEN :startDate AND :endDate
                    ) from_record
                    LEFT JOIN seuecard.trcd       t_trcd ON from_record.trancode = t_trcd.trancode
                    LEFT JOIN seuecard.mercacc    t_mercacc ON from_record.to_merc_account = t_mercacc.account
                UNION
                SELECT
                    to_record.tran_timestamp,
                    t_trcd.tranname,
                    NULL  mercname,
                    tranamt,
                    cardbalance,
                    ebagamt,
                    tran_resume,
                    'TO'  trantype
                FROM
                    (
                        SELECT
                            trjn.toaccount      to_merc_account,
                            trjn.trancode       trancode,
                            trjn.jndatetime     tran_timestamp,
                            trjn.cardbalance    cardbalance,
                            trjn.tranamt        tranamt,
                            trjn.resume         tran_resume,
                            trjn.ebagamt        ebagamt
                        FROM
                        ${tableName} trjn,
                            (
                                SELECT
                                    account
                                FROM
                                    seuecard.account
                                WHERE
                                    sno = :cardnum
                            ) cardnum_to_account
                        WHERE
                            trjn.toaccount = cardnum_to_account.account
                            AND trjn.jndatetime BETWEEN :startDate AND :endDate
                    ) to_record
                    LEFT JOIN seuecard.trcd t_trcd ON to_record.trancode = t_trcd.trancode
            )
        ORDER BY
            tran_timestamp ASC
      `, {
            cardnum: cardnum.padEnd(20, ' '),
            startDate: moment(date + ' 00:00:00', 'YYYY-MM-DD HH:mm:ss').toDate(),
            endDate: moment(date + ' 23:59:59', 'YYYY-MM-DD HH:mm:ss').toDate()
          })
          return record.rows
        } catch (e) {
          return []
        }

      }


      let detail = [
        ...(await getTrans('seuecard.histrjn' + moment(date, 'YYYY-MM-DD').format('YYYYMM')))
      ]

      // 月末的数据可能会跑到下个月的表中，此处需作处理
      if (moment(date, 'YYYY-MM-DD').format('YYYYMM') !== moment().format('YYYYMM')) {
        detail.concat(...(await getTrans('seuecard.histrjn' + moment(date, 'YYYY-MM-DD').add(1, 'M').format('YYYYMM'))))
      }

      const trim = (s) => s ? s.trim() : ''

      detail = detail.map(k => {
        return {
          mecrname: trim(k[1]),
          tranname: trim(k[2]),
          desc: trim(k[2]) + '：' + trim(k[1]),
          amount: k[3] / 100,
          balance: k[4] / 100,
          time: moment(k[6]).unix(),
          resume: trim(k[7])
        }
      }).sort((a, b) => a < b)
      return { info, detail }
    } finally {
      await db.close()
    }
  },
}
