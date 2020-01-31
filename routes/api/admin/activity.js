const moment = require('moment')

exports.route = {
  async get({ page = 1, pagesize = 10 }) {
    if (!this.user.isLogin) {
      throw 401
    }
    if (!(await this.hasPermission('publicity'))) {
      throw 403
    }
    // 这是一个分页
    let activityList = await this.db.execute(`
      SELECT ID,TITLE,PIC,URL,CONTENT,END_TIME,START_TIME
      FROM (SELECT tt.*, ROWNUM AS rowno
        FROM (SELECT t.* FROM TOMMY.H_ACTIVITY t ORDER BY END_TIME DESC) tt
        WHERE ROWNUM < :endRow) table_alias
      WHERE table_alias.rowno >= :startRow`,
    {
      startRow: (page - 1) * pagesize,
      endRow: page * pagesize
    })

    let res = []

    // 整理数据格式
    // 数据段名称
    const fieldName = activityList.metaData.map(item => {
      if (item.name.split('_').length === 1) {
        return item.name.toLowerCase()
      } else {
        return item.name.split('_')[0].toLowerCase() +
          (item.name.split('_')[1].charAt(0).toUpperCase() + item.name.split('_')[1].slice(1).toLowerCase())
      }
    })
    // 原始数据
    const data = activityList.rows
    data.forEach(oneData => {
      let tempData = {}
      oneData.forEach((item, index) => {
        if (index === 5 || index === 6) {
          item = +moment(item)
        }
        tempData[fieldName[index]] = item
        tempData['click'] = 0
      })
      res.push(tempData)
    })

    // 获取点击次数
    for (let index in res) {
      let clicks = await this.db.execute(
        `SELECT COUNT(:id) AS CLICKS FROM TOMMY.H_ACTIVITY_CLICK WHERE AID= :id`,
        {
          id: res[index].id
        })
      res[index].click = clicks.rows[0][0]
    }

    return res

  },

  // 添加一条活动设置
  /*
  * 注意检查日期格式 YYYY-MM-DD HH:mm:ss
  */
  async post({ activity }) {
    if (!await this.hasPermission('publicity')) {
      throw 403
    }
    if (!(activity.title && activity.pic && activity.endTime && activity.startTime)) {
      throw '设置内容不完全'
    }
    if (activity.startTime !== moment(activity.startTime, 'YYYY-MM-DD HH:mm:ss').format('YYYY-MM-DD HH:mm:ss')) {
      throw '起始日期格式不合法'
    }
    if (activity.endTime !== moment(activity.endTime, 'YYYY-MM-DD HH:mm:ss').format('YYYY-MM-DD HH:mm:ss')) {
      throw '结束日期格式不合法'
    }
    if (+moment(activity.endTime, 'YYYY-MM-DD HH:mm:ss') < +moment(activity.startTime, 'YYYY-MM-DD HH:mm:ss')) {
      throw '结束日期小于开始日期'
    }
    // 向数据库插入记录
    await this.db.execute(
      `INSERT INTO TOMMY.H_ACTIVITY 
      (TITLE, PIC, URL, CONTENT, END_TIME, START_TIME)
      VALUES (:title, :pic, :url, :content, :endTime, :startTime)
      `,
      {
        title: activity.title,
        pic: activity.pic,
        url: activity.url,
        content: activity.content,
        endTime: moment(activity.endTime, 'YYYY-MM-DD HH:mm:ss').toDate(),
        startTime: moment(activity.startTime, 'YYYY-MM-DD HH:mm:ss').toDate(),
      }
    )
    return 'OK'
  },

  // 修改一条活动设置
  /*
  * 注意检查日期格式 YYYY-MM-DD HH:mm:ss
  */
  async put({ activity }) {
    if (!this.user.isLogin) {
      throw 401
    }
    if (!(await this.hasPermission('publicity'))) {
      throw 403
    }
    if (!(activity.id && activity.title && activity.pic && activity.endTime && activity.startTime)) {
      throw '设置内容不完全'
    }
    if (activity.startTime !== moment(activity.startTime, 'YYYY-MM-DD HH:mm:ss').format('YYYY-MM-DD HH:mm:ss')) {
      throw '起始日期格式不合法'
    }
    if (activity.endTime !== moment(activity.endTime, 'YYYY-MM-DD HH:mm:ss').format('YYYY-MM-DD HH:mm:ss')) {
      throw '结束日期格式不合法'
    }
    if (+moment(activity.endTime, 'YYYY-MM-DD HH:mm:ss') < +moment(activity.startTime, 'YYYY-MM-DD HH:mm:ss')) {
      throw '结束日期小于开始日期'
    }
    // await db.banner.update({ bid: banner.bid }, banner)
    // 更新数据库记录
    await this.db.execute(`
              UPDATE TOMMY.H_ACTIVITY
              SET TITLE = :title, PIC = :pic, CONTENT =: content,
                  END_TIME = :endTime, START_TIME =: startTime, URL =: url
              WHERE ID = :id
              `,
    {
      id: activity.id,
      title: activity.title,
      pic: activity.pic,
      url: activity.url,
      content: activity.content,
      endTime: moment(activity.endTime, 'YYYY-MM-DD HH:mm:ss').toDate(),
      startTime: moment(activity.startTime, 'YYYY-MM-DD HH:mm:ss').toDate(),
    })

    // await bannerCollection.updateOne({bid: banner.bid}, {$set:banner})
    return 'OK'
  },

  // 删除一条活动并删除对应的点击记录
  async delete({ id }) {
    if (!this.user.isLogin) {
      throw 401
    }
    if (!(await this.hasPermission('publicity'))) {
      throw 403
    }
    await this.db.execute(`DELETE FROM TOMMY.H_ACTIVITY WHERE ID = :id`, { id })
    await this.db.execute(`DELETE FROM TOMMY.H_ACTIVITY_CLICK WHERE AID = :id`, { id })

    return 'OK'
  }
}
