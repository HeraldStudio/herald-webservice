/**
 * @apiDefine exam 考试
 */
const oracledb = require('oracledb')
exports.route = {

  /**
  * @api {GET} /api/exam 创建自定义考试
  * @apiGroup exam

  **/

  async get() {
    let now = +moment()
    let { cardnum } = this.user
    let response = await this.userCache('10m+', async () => {
      // 获取考试数据
      let record = await this.db.execute(`
      select T_KW_KSAPSJ.XNXQDM,T_ZXBZ_XXXQ.MC,T_KC_KCB.KCM,T_KW_KSPC.KSMC,T_JZG_JBXX.XM,T_KW_KSAPSJ.KSSJMS,T_JAS_JBXX.JASMC,T_KW_KSAPSJ.KSSC ,t_kw_ksrw.KSRWID
      from (
        select *
        from T_KW_KSAPXS
        where T_KW_KSAPXS.xh=:cardnum
      )a
      left join T_KW_KSAPSJ
      on a.ksrwid = T_KW_KSAPSJ.ksrwid
      left join T_KW_KSAPDD
      on a.ksrwid = T_KW_KSAPDD.ksrwid and a.ksapbh = T_KW_KSAPDD.ksapbh
      left join T_JAS_JBXX
      on t_kw_ksapdd.jasdm = T_JAS_JBXX.jasdm
      left join T_KW_KSRW
      on a.ksrwid = T_KW_KSRW.ksrwid
      left join T_ZXBZ_XXXQ
      on T_ZXBZ_XXXQ.dm = T_KW_KSRW.XXXQDM
      left join T_XK_XKXS
      on T_XK_XKXS.XH = A.XH AND T_XK_XKXS.KCH = T_KW_KSRW.KCH
      left join T_RW_JSB
      on T_RW_JSB.jxbid = T_XK_XKXS.jxbid
      left join t_jzg_jbxx
      on t_jzg_jbxx.zgh = t_rw_jsb.jsh
      left join T_KC_KCB
      on t_kw_ksrw.kch = t_kc_kcb.kch
      left join T_KW_KSPC
      on T_KW_KSPC.ksdm = t_kw_ksrw.ksdm
      `, [cardnum])
      let result = record.rows.map(Element => {
        let [semester, campus, courseName, courseType, teacherName, time, location, duration] = Element
        let startMoment = moment(time, 'YYYY-MM-DD HH:mm(dddd)')
        let startTime = +startMoment
        let endTime = +startMoment.add(duration, 'minutes')
        courseName = courseName + ' ' + courseType.split(' ')[1]
        return { semester, campus, courseName, teacherName, startTime, endTime, location, duration }
      })
      return result
    })
    // 获取自定义考试数据
    let customExam = await this.db.execute(`
          select semester, campus, courseName, teacherName, startTime, endTime, location, duration, wid
          from h_my_exam
          where cardnum=:cardnum
        `, [cardnum])

    customExam.rows.map(Element => {
      let [semester, campus, courseName, teacherName, startTime, endTime, location, duration, _id] = Element
      response.push({ semester, campus, courseName, teacherName, startTime, endTime, location, duration, _id })
    })
    // 前端要求，除去值为null的字段
    response.forEach(Element => {
      for (let e in Element) {
        if (Element[e] === null)
          delete Element[e]
      }
    })
    response = response.filter(e => {
      return ('_id' in e) || e.endTime > now
      // 自定义的考试/事务一直存在，除非手动删除
      // 学校的考试安排，考试结束后过滤
    })
    response.sort((a, b) => a.startTime - b.startTime)
    return response
  },

  /**
  * @api {POST} /api/exam 创建自定义考试课程
  * @apiGroup exam
  * @apiParam {String} campus      考试校区
  * @apiParam {String} courseName  考试名
  * @apiParam {String} credit      学分
  * @apiParam {String} location    考试地点
  * @apiParam {String} duration    考试持续时间
  * @apiParam {String} teacherName 课程类型
  * @apiParam {String} startTime   考试开始时间
  * @apiParam {String} semester    学期
  **/

  async post({ semester, campus, courseName, teacherName, startTime, location, duration }) {
    let { cardnum } = this.user
    // console.log({ semester, campus, courseName, teacherName, startTime, location, duration })
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
  /**
  * @api {DELETE} /api/exam 删除自定义考试课程
  * @apiGroup exam
  * @apiParam {String} _id 
  **/
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
