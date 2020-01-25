const cheerio = require('cheerio')
const oracledb = require('oracledb')
exports.route = {

  /**
  * GET /api/exam
  * @apiReturn [{ semester, campus, courseName, teacherName, startTime, endTime, location, duration }]
  * 个人考试信息查询
  **/

  async get() {

    let { cardnum } = this.user

    let now = +moment()

    // 获取考试数据
    let record = await this.db.execute(`
    select h.XNXQDM, MC, KCM, T_KW_KSPC.KSMC, h.XM, KSSJMS, JASMC, KSSC
    from T_KW_KSPC,(
      select  g.XNXQDM,g.MC,T_KC_KCB.KCM,T_JZG_JBXX.XM,g.KSSJMS,JASMC, KSSC, g. KSDM
      from T_JZG_JBXX,T_KC_KCB,(
        select   T_RW_JSB.JSH,f.MC, f.JASMC, f.KSRWID, f.KSSC, f.KSSJMS, f.XNXQDM, f.KCH, f.JXBID, f.KSDM
        from T_RW_JSB,(
          select T_ZXBZ_XXXQ.MC,e.JASMC, KSRWID, KSSC, KSSJMS, XNXQDM, KCH, JXBID, KSDM
          from T_ZXBZ_XXXQ,(
            select  d.JASMC, d.KSRWID, d.KSSC, d.KSSJMS, d.XNXQDM,T_KW_KSRW.KCH,XXXQDM,JXBID,KSDM
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
      where T_JZG_JBXX.ZGH=g.JSH and g.KCH=T_KC_KCB.KCH)h
    where T_KW_KSPC.KSDM = h.KSDM
    `,[cardnum])
    let result = record.rows.map(Element => {
      let [semester, campus, courseName, courseType, teacherName, time, location, duration] = Element
      console.log(Element)
      let startMoment = moment(time, 'YYYY-MM-DD HH:mm(dddd)')
      let startTime = +startMoment
      let endTime = +startMoment.add(duration, 'minutes')
      courseName = courseName + ' ' + courseType.split(' ')[1]
      return { semester, campus, courseName, teacherName, startTime, endTime, location, duration }
    })

    // 获取自定义考试数据
    let customExam = await this.db.execute(`
      select semester, campus, courseName, teacherName, startTime, endTime, location, duration
      from t_my_exam
      where cardnum=:cardnum
    `, [cardnum])

    customExam.rows.map(Element => {
      let [semester, campus, courseName, teacherName, startTime, endTime, location, duration] = Element
      result.push({ semester, campus, courseName, teacherName, startTime, endTime, location, duration })
    })

    // result.filter( e => e.endTime > now)// 防止个别考生考试开始了还没找到考场🤔
    return result
  },

  /**
  * POST /api/exam
  * 自定义考试
  * @apiParam semester    学年学期
  * @apiParam campus      校区
  * @apiParam courseName  课程名
  * @apiParam teacherName 老师名
  * @apiParam startTime   开始时间   格式 'YYYY-MM-DD HH:mm:ss'
  * @apiParam location    考试地点
  * @apiParam duration    考试时长   单位：分
  **/

  async post({ semester, campus, courseName, teacherName, startTime, location, duration }) {

    let { cardnum } = this.user

    startMoment = moment(startTime, 'YYYY-MM-DD HH:mm:ss')
    startTime = +startMoment
    let endTime = +startMoment.add(duration, 'minutes')

    sql = `INSERT INTO T_MY_EXAM VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9)`;

    binds = [
      [semester, campus, courseName, teacherName, startTime, endTime, location, duration, cardnum],
    ];

    options = {
      autoCommit: true,

      bindDefs: [
        { type: oracledb.STRING, maxSize: 20 },
        { type: oracledb.STRING, maxSize: 200 },
        { type: oracledb.STRING, maxSize: 100 },
        { type: oracledb.STRING, maxSize: 90 },
        { type: oracledb.NUMBER },
        { type: oracledb.NUMBER },
        { type: oracledb.STRING, maxSize: 200 },
        { type: oracledb.STRING, maxSize: 10 },
        { type: oracledb.STRING, maxSize: 20 },
      ]
    };

    result = await this.db.executeMany(sql, binds, options);

    if (result.rowsAffected > 0) {
      return '自定义考试成功'
    } else {
      throw '自定义考试失败'
    }
  }

}
