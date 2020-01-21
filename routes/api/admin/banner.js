const mongodb = require('../../../database/mongodb')
const oracleFormat = require('../../../tool/oracleDataformat').format
const moment = require('moment')
exports.route = {
  async get ({ page = 1, pagesize = 10 }) {
    // let bannerCollection = await mongodb('herald_banner')
    // let bannerClickCollection = await mongodb('herald_banner_click')
    if (!(this.hasPermission('publicity') && this.user.isLogin)) {
      throw 403
    }
    
    let bannerList = await this.db.execute(`
      SELECT title,pic,url,,BID,ENDTIME,STARTTIME
      FROM (SELECT tt.*, ROWNUM AS rowno
        FROM (  SELECT t.* FROM H_BANNER t ORDER BY ENDTIME DESC) tt
        WHERE ROWNUM < :endRow) table_alias
      WHERE table_alias.rowno >= :startRow`,
    {
      startRow: (page - 1) * pagesize,
      endRow: page * pagesize
    })
    bannerList = oracleFormat(bannerList)

    // return await Promise.all((await bannerCollection.find().sort('endTime', -1).skip((page - 1) * pagesize).limit(parseInt(pagesize)).toArray())
    //   .map(async k => {
    //     k.clicks = await bannerClickCollection.countDocuments({ bid: k.bid })
    //     return k
    //   }))
  },

  // 添加一条轮播头图
  /*
  * 注意检查日期格式 YYYY-MM-DD HH:mm:ss
  */
  async post ({ banner }) {
    // let bannerCollection = await mongodb('herald_banner')
    if (!(this.user.isLogin && await this.hasPermission('publicity'))) {
      throw 403
    }
    if (!( banner.title && banner.pic && banner.endTime && banner.startTime )){
      throw '设置内容不完全'
    }
    if (banner.startTime !== moment(banner.startTime , 'YYYY-MM-DD HH:mm:ss').format('YYYY-MM-DD HH:mm:ss')){
      throw '起始日期格式不合法'
    }
    if (banner.endTime !== moment(banner.endTime , 'YYYY-MM-DD HH:mm:ss').format('YYYY-MM-DD HH:mm:ss')){
      throw '结束日期格式不合法'
    }
    // 向数据库插入记录
    await this.db.execute(
      `INSERT INTO TOMMY.H_BANNER 
      (TITLE, PIC, URL, SCHOOLNUM_PREFIX, END_TIME, START_TIME)
      VALUES (:title, :pic, :url, :schoolnumPrefix, :endTime, :startTime)
      `,
      { 
        title:banner.title,
        pic:banner.pic,
        url:banner.url,
        schoolnumPrefix:banner.schoolnumPrefix,
        endTime:moment(banner.endTime , 'YYYY-MM-DD HH:mm:ss').toDate(),
        startTime:moment(banner.startTime , 'YYYY-MM-DD HH:mm:ss').toDate(),
      }
    )
    //await db.banner.insert(banner)
    
    //await bannerCollection.insertOne(banner)
    return 'OK'
  },
  
  // 修改轮播图设置
  /*
  * 注意检查日期格式 YYYY-MM-DD HH:mm:ss
  */
  async put ({ banner }) {
    //let bannerCollection = await mongodb('herald_banner')
    if (!(this.user.isLogin && await this.hasPermission('publicity'))) {
      throw 403
    }
    if (!( banner.id && banner.title && banner.pic && banner.endTime && banner.startTime )){
      throw '设置内容不完全'
    }
    if (banner.startTime !== moment(banner.startTime , 'YYYY-MM-DD HH:mm:ss').format('YYYY-MM-DD HH:mm:ss')){
      throw '起始日期格式不合法'
    }
    if (banner.endTime !== moment(banner.endTime , 'YYYY-MM-DD HH:mm:ss').format('YYYY-MM-DD HH:mm:ss')){
      throw '结束日期格式不合法'
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
      id:banner.id, 
      title:banner.title,
      pic:banner.pic,
      url:banner.url,
      schoolnumPrefix:banner.schoolnumPrefix,
      endTime:moment(banner.endTime , 'YYYY-MM-DD HH:mm:ss').toDate(),
      startTime:moment(banner.startTime , 'YYYY-MM-DD HH:mm:ss').toDate(),
    })
    
    // await bannerCollection.updateOne({bid: banner.bid}, {$set:banner})
    return 'OK'
  },
  async delete ({ bid }) {
    let bannerCollection = await mongodb('herald_banner')
    let bannerClickCollection = await mongodb('herald_banner_click')
    if (!this.admin || !this.admin.publicity) {
      throw 403
    }
    //await db.banner.remove({ bid })
    //await db.bannerClick.remove({ bid })
    bid = parseInt(bid)
    await bannerCollection.deleteOne({ bid })
    await bannerClickCollection.deleteMany({ bid })
    return 'OK'
  }
}
