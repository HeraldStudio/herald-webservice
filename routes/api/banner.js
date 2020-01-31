
const moment = require('moment')

exports.route = {
  async get() {
    if (!this.user.isLogin) {
      // 强制一下，必须在登录态才能获取链接
      throw 401
    }
    let bannerList = await this.db.execute(`
    SELECT ID,URL,TITLE,PIC,SCHOOLNUM_PREFIX,START_TIME,END_TIME,SCHOOLNUM_PREFIX 
    FROM TOMMY.H_BANNER p
    WHERE :nowTime between p.start_time and p.end_time ORDER BY p.START_TIME DESC`,
    {
      nowTime: +moment()
    })

    let res = []
    // 整理一下数据格式
    const fieldName = bannerList.metaData.map(item => {
      if (item.name.split('_').length === 1) {
        return item.name.toLowerCase()
      } else {
        return item.name.split('_')[0].toLowerCase() +
          (item.name.split('_')[1].charAt(0).toUpperCase() + item.name.split('_')[1].slice(1).toLowerCase())
      }
    })
    const data = bannerList.rows
    data.forEach(oneData => {
      let tempData = {}
      oneData.forEach((item, index) => {
        tempData[fieldName[index]] = item
      })
      res.push(tempData)
    })

    // 按照学号过滤
    res = res.filter(k => {
      if (k.schoolnumPrefix === null) return true
      let result = false
      const prefixList = k.schoolnumPrefix.split(' ')
      prefixList.forEach(prefix => {
        if (this.user.schoolnum.startsWith(prefix)) result = true
      })
      return result
    }).map(k => {
      // 去除链接
      k.hasUrl = !!k.url
      delete k.url
      return k
    })

    return res
  },

  /**
   * PUT /api/banner
   * 根据 id 获取轮播图点击链接
   * 
   * 注：标准的前后端分离不应该有重定向 API，后端只负责提供数据，不应该控制浏览器做任何事
   * 因此这里使用 put 请求，若前端已登录，仍然需要带着 token 来请求，以便统计点击量
   */
  async put({ id }) {
    if (!this.user.isLogin) {
      // 强制一下，必须在登录态才能获取链接
      throw 401
    }
    if (!id) {
      throw '未指定轮播图id'
    }
    let banner = await this.db.execute(
      `SELECT TITLE, URL from TOMMY.H_BANNER WHERE ID = :id`,
      {
        id
      }
    )

    if (banner.rows.length === 0) {
      throw 404
    }
    // 成功获取链接，插入一条点击链接的记录
    await this.db.execute(
      `INSERT INTO TOMMY.H_BANNER_CLICK
      (CARDNUM, BID, CREATED_TIME )
      VALUES (:cardnum, :bid, :creatTime)
      `,
      {
        cardnum: this.user.cardnum,
        bid: id,
        creatTime: +moment()
      })
    return banner.rows[0][1] ? banner.rows[0][1] : 'javascript:void(0)'
  }
}
