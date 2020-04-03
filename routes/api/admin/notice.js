let moment = require('moment')

exports.route = {
  /**
  * @api {GET} /api/admin/notice 获取通知
  * @apiGroup admin
  * 
  * @apiParam {Number} page=1 页码
  * @apiParam {Number} pagesize=10 页面尺寸
  */
  async get ({ page = 1, pagesize = 10 }) {
    if (!(await this.hasPermission('publicity'))) {
      throw 403
    }
    let noticeList = await this.db.execute(`
      SELECT ID,TITLE,CONTENT,URL,SCHOOLNUM_PREFIX,PUBLISH_TIME
      FROM (SELECT tt.*, ROWNUM AS rowno
        FROM (SELECT t.* FROM TOMMY.H_NOTICE t ORDER BY PUBLISH_TIME DESC) tt
        WHERE ROWNUM <= :endRow) table_alias
      WHERE table_alias.rowno > :startRow`,
    {
      startRow: (page - 1) * pagesize,
      endRow: page * pagesize
    })
    
    let res = []
    // 数据段名称
    const fieldName = noticeList.metaData.map(item => {
      if (item.name.split('_').length === 1) {
        return item.name.toLowerCase()
      } else {
        return item.name.split('_')[0].toLowerCase() +
          (item.name.split('_')[1].charAt(0).toUpperCase() + item.name.split('_')[1].slice(1).toLowerCase())
      }
    })
    const data = noticeList.rows
    data.forEach(oneData => {
      let tempData = {}
      oneData.forEach((item, index) => {
        if (index === 5 ) {
          item = +moment(item)
        }
        tempData[fieldName[index]] = item
      })
      res.push(tempData)
    })
    
    return res
  },

  /**
  * @api {POST} /api/admin/notice 添加通知
  * @apiGroup admin
  * 
  * @apiParam {Object} notice
  */
  /**
   * 学号前缀 schoolnumPrefix:"06 70 ..."
  */
  async post ({ notice }) {
    let now = moment()
    if (!(await this.hasPermission('publicity'))) {
      throw 403
    }
    if (!(notice.title && notice.content)) {
      throw '设置内容不完全'
    }
    // 向数据库插入记录
    await this.db.execute(
      `INSERT INTO TOMMY.H_NOTICE 
      (TITLE, CONTENT, URL, SCHOOLNUM_PREFIX, PUBLISH_TIME)
      VALUES (:title, :content, :url, :schoolnumPrefix, :publishTime)
      `,
      {
        title: notice.title,
        url: notice.url,
        content: notice.content,
        schoolnumPrefix: notice.schoolnumPrefix,
        publishTime: now.toDate()
      }
    )
    
    return 'OK'
  },
  /**
  * @api {PUT} /api/admin/notice 修改通知
  * @apiGroup admin
  * 
  * @apiParam {Object} notice
  */
  /**
   *
   * 学号前缀 schoolnumPrefix:"06 70 ..."
   *  
  */
  async put ({ notice }) {
    let now = moment()
    if (!this.user.isLogin) {
      throw 401
    }
    if (!(await this.hasPermission('publicity'))) {
      throw 403
    }
    if (!( notice.id &&notice.title && notice.content)) {
      throw '设置内容不完全'
    }
    await this.db.execute(`
    UPDATE TOMMY.H_NOTICE
    SET TITLE = :title, URL = :url, SCHOOLNUM_PREFIX =: schoolnumPrefix, 
        PUBLISH_TIME =: publishTime, CONTENT =: content
    WHERE ID = :id
    `,
    {
      id: notice.id,
      title: notice.title,
      content: notice.content,
      url: notice.url,
      schoolnumPrefix: notice.schoolnumPrefix,
      publishTime: now.toDate(),
    })
    return 'OK'
  },

  /**
  * @api {DELETE} /api/admin/notice 删除通知
  * @apiGroup admin
  * 
  * @apiParam {String} id
  */
  async delete ({ id }) {
    if (!(await this.hasPermission('publicity'))) {
      throw 403
    }
    await this.db.execute(`DELETE FROM TOMMY.H_NOTICE WHERE ID = :id`, { id })

    return 'OK'

  }
}
