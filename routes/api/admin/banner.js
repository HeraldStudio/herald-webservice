
const moment = require('moment')
exports.route = {
  // 管理员获取 banner 列表
  async get({ page = 1, pagesize = 10 }) {

    if (!(this.hasPermission('publicity') && this.user.isLogin)) {
      throw 403
    }
    // 这是一个分页
    let bannerList = await this.db.execute(`
      SELECT ID,TITLE,PIC,URL,SCHOOLNUM_PREFIX,END_TIME,START_TIME
      FROM (SELECT tt.*, ROWNUM AS rowno
        FROM (SELECT t.* FROM TOMMY.H_BANNER t ORDER BY END_TIME DESC) tt
        WHERE ROWNUM < :endRow) table_alias
      WHERE table_alias.rowno >= :startRow`,
    {
      startRow: (page - 1) * pagesize,
      endRow: page * pagesize
    })

    // 整理数据格式
    // 数据段名称
    const fieldName = bannerList.metaData.map(item => {
      if (item.name.split('_').length === 1) {
        return item.name.toLowerCase()
      } else {
        return item.name.split('_')[0].toLowerCase() +
          (item.name.split('_')[1].charAt(0).toUpperCase() + item.name.split('_')[1].slice(1).toLowerCase())
      }
    })
    // 原始数据
    const data = bannerList.rows
    let res = []
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
    for(let index in res){
      let clicks = await this.db.execute(
        `SELECT COUNT(:id) AS CLICKS FROM TOMMY.H_BANNER_CLICK WHERE BID= :id`,
        {
          id: res[index].id
        })
      res[index].click = clicks.rows[0][0]
    }
    return res

    // 👇下面的代码的有点问题，数据库操作出现问题，暂时先放在这里
    // res.map(async k => {
    //   let click = await this.db.execute(
    //     `SELECT COUNT(:ID) AS CLICKS FROM TOMMY.H_BANNER_CLICK WHERE BID= :ID`,
    //     {
    //       id: k.id
    //     })
    //   k.click = click.rows[0]
    //   return k
    // })


    //console.log(res)
    // return await Promise.all((await bannerCollection.find().sort('endTime', -1).skip((page - 1) * pagesize).limit(parseInt(pagesize)).toArray())
    //   .map(async k => {
    //     k.clicks = await bannerClickCollection.countDocuments({ bid: k.bid })
    //     return k
    //   }))
  },

  // 添加一条轮播头图
  /*
  * 注意检查日期格式 时间戳
  * 学号前缀 schoolnumPrefix:"06 70 ..."
  */
  async post({ banner }) {
    // let bannerCollection = await mongodb('herald_banner')
    if (!(this.user.isLogin && await this.hasPermission('publicity'))) {
      throw 403
    }
    if (!(banner.title && banner.pic && banner.endTime && banner.startTime)) {
      throw '设置内容不完全'
    }
    if (typeof(banner.startTime) !== typeof(+moment())) {
      throw '起始日期格式不合法'
    }
    if (typeof(banner.endTime) !== typeof(+moment())) {
      throw '结束日期格式不合法'
    }
    if (banner.endTime < banner.startTime){
      throw '结束日期小于开始日期'
    }
    // 向数据库插入记录
    await this.db.execute(
      `INSERT INTO TOMMY.H_BANNER 
      (TITLE, PIC, URL, SCHOOLNUM_PREFIX, END_TIME, START_TIME)
      VALUES (:title, :pic, :url, :schoolnumPrefix, :endTime, :startTime)
      `,
      {
        title: banner.title,
        pic: banner.pic,
        url: banner.url,
        schoolnumPrefix: banner.schoolnumPrefix,
        endTime: banner.endTime,
        startTime: banner.startTime,
      }
    )
    //await db.banner.insert(banner)

    //await bannerCollection.insertOne(banner)
    return 'OK'
  },

  // 修改轮播图设置
  /*
  * 注意检查日期格式 时间戳
  */
  async put({ banner }) {
    if (!(this.user.isLogin && await this.hasPermission('publicity'))) {
      throw 403
    }
    if (!(banner.id && banner.title && banner.pic && banner.endTime && banner.startTime)) {
      throw '设置内容不完全'
    }
    if (typeof(banner.startTime) !== typeof(+moment())) {
      throw '起始日期格式不合法'
    }
    if (typeof(banner.endTime) !== typeof(+moment())) {
      throw '结束日期格式不合法'
    }
    if (banner.endTime < banner.startTime){
      throw '结束日期小于开始日期'
    }
    // await db.banner.update({ bid: banner.bid }, banner)
    // 更新数据库记录
    await this.db.execute(`
              UPDATE TOMMY.H_BANNER
              SET TITLE = :title, PIC = :pic, SCHOOLNUM_PREFIX =: schoolnumPrefix,
                  END_TIME = :endTime, START_TIME =: startTime, URL =: url
              WHERE ID = :id
              `,
    {
      id: banner.id,
      title: banner.title,
      pic: banner.pic,
      url: banner.url,
      schoolnumPrefix: banner.schoolnumPrefix,
      endTime: banner.endTime,
      startTime: banner.startTime,
    })

    // await bannerCollection.updateOne({bid: banner.bid}, {$set:banner})
    return 'OK'
  },

  // 删除一条轮播图并删除对应的点击记录
  async delete({ id }) {
    if (!(this.user.isLogin && await this.hasPermission('publicity'))) {
      throw 403
    }
    await this.db.execute(`DELETE FROM TOMMY.H_BANNER WHERE ID = :id`, { id })
    await this.db.execute(`DELETE FROM TOMMY.H_BANNER_CLICK WHERE BID = :id`, { id })

    return 'Ok'

  }
}
