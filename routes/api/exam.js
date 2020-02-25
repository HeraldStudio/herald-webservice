const oracledb = require('oracledb')
exports.route = {

  /**
  * GET /api/exam
  * @apiReturn [{ semester, campus, courseName, teacherName, startTime, endTime, location, duration }]
  * 个人考试信息查询
  **/

  async get() {
    let now = +moment()
    let response = await this.userCache('10m+', async () => {
      let { cardnum } = this.user
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
      `, [cardnum])
      let result = record.rows.map(Element => {
        let [semester, campus, courseName, courseType, teacherName, time, location, duration] = Element
        let startMoment = moment(time, 'YYYY-MM-DD HH:mm(dddd)')
        let startTime = +startMoment
        let endTime = +startMoment.add(duration, 'minutes')
        courseName = courseName + ' ' + courseType.split(' ')[1]
        return { semester, campus, courseName, teacherName, startTime, endTime, location, duration }
      })

      // 获取自定义考试数据
      let customExam = await this.db.execute(`
        select semester, campus, courseName, teacherName, startTime, endTime, location, duration, wid
        from h_my_exam
        where cardnum=:cardnum
      `, [cardnum])

      customExam.rows.map(Element => {
        let [semester, campus, courseName, teacherName, startTime, endTime, location, duration, _id] = Element
        result.push({ semester, campus, courseName, teacherName, startTime, endTime, location, duration, _id })
      })
      // 前端要求，除去值为null的字段
      result.forEach(Element => {
        for (let e in Element) {
          if (Element[e] === null)
            delete Element[e]
        }
      })
      return result
    })
    response = response.filter(e => {
      return  ('_id' in e) || e.endTime > now
      // 自定义的考试/事务一直存在，除非手动删除
      // 学校的考试安排，考试结束后过滤
    })
    return response
  },

  /**
  * POST /api/exam
  * 自定义考试
  * @apiParam semester    学年学期
  * @apiParam campus      校区       ['九龙湖', '丁家桥', '四牌楼']
  * @apiParam courseName  课程名
  * @apiParam teacherName 老师名
  * @apiParam startTime   开始时间   格式：时间戳
  * @apiParam location    考试地点
  * @apiParam duration    考试时长   单位：分
  **/

  async post({ semester, campus, courseName, teacherName, startTime, location, duration }) {
    let { cardnum } = this.user
    console.log({ semester, campus, courseName, teacherName, startTime, location, duration })
    if (!semester) {
      throw '未定义学期'
    }
    if (!courseName) {
      throw '未定义课程名'
    }
    if (!startTime || !duration) {
      throw '未定义时间'
    }
    let endTime = startTime + duration * 60 * 1000

    let sql = `INSERT INTO H_MY_EXAM VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9, sys_guid())`

    let binds = [
      [semester, campus, courseName, teacherName, startTime, endTime, location, duration, cardnum],
    ]
    let options = {
      autoCommit: true,

      bindDefs: [
        { type: oracledb.STRING, maxSize: 20 },
        { type: oracledb.STRING, maxSize: 200 },
        { type: oracledb.STRING, maxSize: 100 },
        { type: oracledb.STRING, maxSize: 90 },
        { type: oracledb.NUMBER },
        { type: oracledb.NUMBER },
        { type: oracledb.STRING, maxSize: 200 },
        { type: oracledb.NUMBER },
        { type: oracledb.STRING, maxSize: 20 },
      ]
    }

    let result = await this.db.executeMany(sql, binds, options)

    if (result.rowsAffected > 0) {
      return '自定义考试成功'
    } else {
      throw '自定义考试失败'
    }
  },
  async delete({ _id }) {
    let record = await this.db.execute(`
    select * from H_MY_EXAM
    where wid=:id
  `, { id: _id })
    record = record.rows[0]

    if (!record) {
      throw '事务不存在'
    }

    let result = await this.db.execute(`
    DELETE from H_MY_EXAM
    WHERE WID =:id
  `, { id: _id })
    if (result.rowsAffected > 0) {
      return '删除成功'
    } else {
      throw '删除失败'
    }
  }

}
