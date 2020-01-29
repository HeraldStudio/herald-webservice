const monent = require('moment')
exports.route = {

  /**
  * api {GET} /api/admin/admin
  * 查询管理员二合一接口
  * 带 domain 参数表示查询指定域下的管理员；不带 domain 参数表示查询自己的管理员身份
  * 
  */
  async get({ domain = '' }) {
    if (!this.user.isLogin) {
      throw 403
    }
    if (domain){
      await this.hasPermission(domain)
      let adminList = await this.db.execute(`
      SELECT p.PERMISSION ,a.CARDNUM ,a.PHONENUM ,a.ACCESS_LEVEL, a.REAL_NAME 
      FROM TOMMY.H_ADMIN a, TOMMY.H_ADMIN_PERMISSION p 
      WHERE a.CARDNUM = p.CARDNUM AND p.PERMISSION = :permission`
      ,{ 
        permission: domain
      })
      let res =[]

      //整理数据格式
      const fieldName = adminList.metaData.map(item => {
        if (item.name.split('_').length === 1) {
          return item.name.toLowerCase()
        } else {
          return item.name.split('_')[0].toLowerCase() +
            (item.name.split('_')[1].charAt(0).toUpperCase() + item.name.split('_')[1].slice(1).toLowerCase())
        }
      })
      const data = adminList.rows
      data.forEach(oneData => {
        let tempData = {}
        oneData.forEach((item, index) => {
          tempData[fieldName[index]] = item
        })
        res.push(tempData)
      })

      return res

    } else{
      return await this.listPermission()
    }

  },

  /**
  * api {POST} /api/admin/admin
  * 添加管理员权限
  * @apiParam { domain, admin: { name, cardnum, phone } }
  */
  async post({ domain, admin }) {
    const now = monent()
    if (!this.user.isLogin) {
      throw 403
    }
    
    await this.hasPermission(domain)
    
    // 获取管理员权限等级
    let adminLevel = await this.db.execute(`
    SELECT ACCESS_LEVEL FROM TOMMY.H_ADMIN WHERE CARDNUM = :cardnum`,
    {
      cardnum: this.user.cardnum
    })
    adminLevel = adminLevel.rows[0][0]

    // 确定新管理员权限等级
    let level = await this.db.execute(`
    SELECT ACCESS_LEVEL FROM TOMMY.H_ADMIN WHERE CARDNUM = :cardnum`,
    {
      cardnum: admin.cardnum
    })
    const isHasLevel = level.rows.length !== 0
    if(!isHasLevel){
      // 没有新管理员的权限等级就新建一个
      await this.db.execute(`INSERT INTO TOMMY.H_ADMIN 
      (CARDNUM, PHONENUM, ACCESS_LEVEL, LAST_INVOKED_TIME, REAL_NAME)
      VALUES (:cardnum, :phonenum, :accessLevel, :lastInvokedTime, :realName)
      `,
      {
        cardnum: admin.cardnum,
        phonenum: admin.phone,
        accessLevel: ++adminLevel,
        lastInvokedTime: now.toDate(),
        realName: admin.name
      })
    }else{
      // 判断权限等级是否满足
      if(adminLevel >= level.rows[0][0]){
        throw "权限等级不足"
      }
      // 有的话就更新一下时间
      await this.db.execute(`
      UPDATE TOMMY.H_ADMIN SET LAST_INVOKED_TIME =: lastInvokedTime WHERE CARDNUM = :cardnum
      `,{
        lastInvokedTime: now.toDate(),
        cardnum: admin.cardnum
      })
    }

    // 添加权限
    // 判断该管理员是否有该权限
    let isHasPermission = await this.db.execute(`
    SELECT COUNT(*) FROM TOMMY.H_ADMIN_PERMISSION 
    WHERE CARDNUM = :cardnum AND PERMISSION = :permission
    `,
    {
      cardnum: admin.cardnum,
      permission: domain
    })
    if(isHasPermission.rows[0][0]){
      throw '该管理员已有该权限'
    }
    await this.db.execute(`
    INSERT INTO TOMMY.H_ADMIN_PERMISSION (CARDNUM,PERMISSION) VALUES (:cardnum, :permission)
    `,
    {
      cardnum: admin.cardnum,
      permission: domain
    })

    return 'OK'
  },

  /**
  * api {PUT} /api/admin/admin
  * 修改管理员信息
  * @apiParam { admin: { name, cardnum, phone } }
  */
  async put({ admin }) {
    const now = monent()
    if (!this.user.isLogin) {
      throw 403
    }

    // 获取当前用户的权限等级
    let adminLevel = await this.db.execute(`
    SELECT ACCESS_LEVEL FROM TOMMY.H_ADMIN WHERE CARDNUM = :cardnum`,
    {
      cardnum: this.user.cardnum
    })
    adminLevel = adminLevel.rows[0][0]

    // 获取被修改管理员的权限等级
    let level = await this.db.execute(`
    SELECT ACCESS_LEVEL FROM TOMMY.H_ADMIN WHERE CARDNUM = :cardnum`,
    {
      cardnum: admin.cardnum
    })
    level = level.rows[0][0]

    if(adminLevel >= level){
      throw '权限等级不足'
    }

    await this.db.execute(`
    UPDATE TOMMY.H_ADMIN
      SET PHONENUM = :phonenum, REAL_NAME = :name, LAST_INVOKED_TIME = :lastInvokedTime
      WHERE CARDNUM= :cardnum`,
    {
      cardnum: admin.cardnum,
      phonenum: admin.phone,
      name: admin.name,
      lastInvokedTime: now.toDate(),
    })

    return 'OK'
  },

  /**
  * api {DELETE} /api/admin/admin
  * 删除管理员权限
  * @apiParam { domain, cardnum }
  */
  async delete({ domain , cardnum }) {
    const now = monent()
    if (!this.user.isLogin) {
      throw 403
    }

    // 指明删除的权限
    if (!domain) {
      throw '未指定权限范围'
    }

    // 确定当前用户的权限
    await this.hasPermission(domain)

    // 获取管理员权限等级
    let adminLevel = await this.db.execute(`
    SELECT ACCESS_LEVEL FROM TOMMY.H_ADMIN WHERE CARDNUM = :cardnum`,
    {
      cardnum: this.user.cardnum
    })
    adminLevel = adminLevel.rows[0][0]

    // 确定删除管理员权限等级
    let level = await this.db.execute(`
    SELECT ACCESS_LEVEL FROM TOMMY.H_ADMIN WHERE CARDNUM = :cardnum`,
    {
      cardnum
    })
    level = level.rows[0][0]

    if( adminLevel>= level ){
      throw '权限等级不足'
    }

    // 删除权限
    await this.db.execute(`
    DELETE FROM TOMMY.H_ADMIN_PERMISSION 
    WHERE CARDNUM = :cardnum AND PERMISSION = :permission`, 
    { 
      cardnum,
      permission:domain
    })
    // 修改时间
    await this.db.execute(`
    UPDATE TOMMY.H_ADMIN SET LAST_INVOKED_TIME = :lastInvokedTime
    WHERE CARDNUM= :cardnum`,
    {
      cardnum,
      lastInvokedTime: now.toDate(),
    })

    return 'OK'
  }
}
