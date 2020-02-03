
const moment = require('moment')

exports.route = {
  async get({ page = 1, pagesize = 10 }) {
    let now = moment()
    if (!this.user.isLogin) {
      throw 401
    }
    // 这是一个分页
    let activityList = await this.db.execute(`
      SELECT ID,TITLE,PIC,URL,CONTENT,END_TIME,START_TIME
      FROM (
        SELECT tt.*, ROWNUM AS rowno
        FROM (
          SELECT t.* 
          FROM TOMMY.H_ACTIVITY t 
          WHERE (:nowTime >= t.START_TIME AND :nowTime <= t.END_TIME) 
        ) tt
        WHERE ROWNUM <= :endRow) table_alias
      WHERE table_alias.rowno > :startRow`,
    {
      nowTime: now.toDate(),
      startRow: (page - 1) * pagesize,
      endRow: page * pagesize,
    })
    let res = []
    // 整理一下数据格式
    const fieldName = activityList.metaData.map(item => {
      if (item.name.split('_').length === 1) {
        return item.name.toLowerCase()
      } else {
        return item.name.split('_')[0].toLowerCase() +
          (item.name.split('_')[1].charAt(0).toUpperCase() + item.name.split('_')[1].slice(1).toLowerCase())
      }
    })
    const data = activityList.rows
    data.forEach(oneData => {
      let tempData = {}
      oneData.forEach((item, index) => {
        if (index === 5 || index === 6) {
          item = moment(item).format('YYYY-MM-DD HH:mm:ss')
        }
        tempData[fieldName[index]] = item
      })
      res.push(tempData)
    })

    res.map(k => {
      // 去除链接
      k.hasUrl = !!k.url
      delete k.url
      return k
    })
    
    return res
  },
  

  /**
   * PUT /api/activity
   * 根据 id 获取活动点击链接
   * 
   * 注：标准的前后端分离不应该有重定向 API，后端只负责提供数据，不应该控制浏览器做任何事
   * 因此这里使用 put 请求，若前端已登录，仍然需要带着 token 来请求，以便统计点击量
   */
  async put({ id }) {
    let now = moment()
    if (!this.user.isLogin) {
      // 强制一下，必须在登录态才能获取链接
      throw 401
    }
    if (!id) {
      throw '未指定活动id'
    }

    let activity = await this.publicCache(id,'1d+',async () => {
      return await this.db.execute(`SELECT TITLE, URL from TOMMY.H_ACTIVITY WHERE ID = :id`,{ id })
    })
    if (activity.rows.length === 0){
      throw 404
    }
    // 成功获取链接，插入一条点击链接的记录
    await this.db.execute(
      `INSERT INTO TOMMY.H_ACTIVITY_CLICK
      (CARDNUM, AID, CREATED_TIME )
      VALUES (:cardnum, :aid, :creatTime)
      `,
      {
        cardnum: this.user.cardnum,
        aid: id,
        creatTime: now.toDate()
      })
    return activity.rows[0][1] ? activity.rows[0][1] : 'javascript:void(0)'
  }
}
