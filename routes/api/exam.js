const cheerio = require('cheerio')

exports.route = {

  /**
  * GET /api/exam
  * 个人考试信息查询
  **/

  async get() {
    // return await this.userCache('2h', async () => {

    let { name, cardnum, schoolnum } = this.user

    let now = +moment()
    console.log(cardnum)
    let record = await this.db.execute(`
    select  g.XNXQDM,g.MC,T_KC_KCB.KCM,T_JZG_JBXX.XM,g.KSSJMS,JASMC, KSSC
    from T_JZG_JBXX,T_KC_KCB,(
      select   T_RW_JSB.JSH,f.MC, f.JASMC, f.KSRWID, f.KSSC, f.KSSJMS, f.XNXQDM, f.KCH, f.JXBID
      from T_RW_JSB,(
        select T_ZXBZ_XXXQ.MC,e.JASMC, KSRWID, KSSC, KSSJMS, XNXQDM, KCH,JXBID
        from T_ZXBZ_XXXQ,(
          select  d.JASMC, d.KSRWID, d.KSSC, d.KSSJMS, d.XNXQDM,T_KW_KSRW.KCH,XXXQDM,JXBID
          from T_KW_KSRW,(
            select T_JAS_JBXX.JASMC,c.KSRWID, KSSC, KSSJMS, XNXQDM
            from T_JAS_JBXX,(
              select T_KW_KSAPDD.JASDM,b.KSRWID,b.KSSC,b.KSSJMS,b.XNXQDM
              from T_KW_KSAPDD,(
                select T_KW_KSAPSJ.XNXQDM,T_KW_KSAPSJ.KSSJMS,T_KW_KSAPSJ.KSSC,T_KW_KSAPSJ.KSRWID,a.KSAPBH
                from T_KW_KSAPSJ,(
                  select T_KW_KSAPXS.KSRWID,T_KW_KSAPXS.KSAPBH
                  from T_KW_KSAPXS
                  where T_KW_KSAPXS.xh=:cardnum)a
                where a.KSRWID=T_KW_KSAPSJ.KSRWID)b
              where T_KW_KSAPDD.KSRWID=b.KSRWID and T_KW_KSAPDD.KSAPBH=b.KSAPBH)c
            where T_JAS_JBXX.JASDM=c.JASDM)d
          where d.KSRWID=T_KW_KSRW.KSRWID)e
        where T_ZXBZ_XXXQ.DM=e.XXXQDM)f
      where T_RW_JSB.JXBID=f.JXBID and T_RW_JSB.KCH=f.KCH)g
    where T_JZG_JBXX.ZGH=g.JSH and g.KCH=T_KC_KCB.KCH
    `,[cardnum])
    let result = record.rows.map( Element => {
      let [semester, campus, courseName, teacherName, time, location, duration]=Element

      let startMoment = moment(time, 'YYYY-MM-DD HH:mm(dddd)')
      let startTime = +startMoment
      let endTime = +startMoment.add(duration, 'minutes')

      return { semester, campus, courseName, teacherName, startTime, endTime, location, duration }
      
    }).filter(k => k.endTime > now)

    console.log(result)
    return result


  }
}
