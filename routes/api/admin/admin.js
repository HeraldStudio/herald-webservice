let db = require('../../../database/admin')
let mongodb = require('../../../database/mongodb')
exports.route = {

  /**
  * api {GET} /api/admin/admin
  * 查询管理员二合一接口
  * 带 domain 参数表示查询指定域下的管理员；不带 domain 参数表示查询自己的管理员身份
  */
  async get({ domain }) {
    
      let adminCollection = await mongodb('herald_admin')
      let domainCollection = await mongodb('herald_admin_domain')
      if (!domain) {
        if (!(this.admin && this.admin.super) && !this.user.isLogin) {
          throw 401
        }
        this.body = ''
        this.status = 200
        return this.admin
      } else {
        // 只允许当前域中的管理员和超级管理员查看当前域中的管理员
        if (!this.admin[domain]) {
          throw 403
        }

        // return {
        //   domain: await db.domain.find({ domain }, 1),
        //   admins: await db.admin.find({ domain })
        // }
        return {
          domain: await domainCollection.findOne({ domain }),
          admins: await adminCollection.find({ domain }).toArray()
        }
      }

  },

  /**
  * api {POST} /api/admin/admin
  * 任命管理员
  * apiParam { domain, admin: { name, cardnum, phone } }
  */
  async post({ domain, admin }) {
    let adminCollection = await mongodb('herald_admin')
    let domainCollection = await mongodb('herald_admin_domain')
    let { name, cardnum, phone } = admin

    // 只允许同域任命
    if (!this.admin[domain]) {
      throw 403
    }

    //let has = await db.admin.find({ cardnum, domain }, 1)
    let has = await adminCollection.findOne({ cardnum, domain })
    if (has) {
      throw '管理员已存在'
    }

    let now = +moment()
    // await db.admin.insert({
    //   cardnum, name, phone, domain,
    //   level: this.admin[domain].level + 1,
    //   authorized: now,
    //   lastUsed: now
    // })
    
    await adminCollection.insertOne({
      cardnum, name, phone, domain,
      level: this.admin[domain].level + 1,
      authorized: now,
      lastUsed: now
    })
    return 'OK'
  },

  /**
  * api {PUT} /api/admin/admin
  * 修改管理员信息
  * apiParam { domain, admin }
  */
  async put({ domain, admin }) {

    let adminCollection = await mongodb('herald_admin')

    // 只允许同域任免
    if (!this.admin[domain]) {
      throw 403
    }

    let has = await adminCollection.findOne({ cardnum: admin.cardnum, domain })
    if (!has) {
      throw '管理员不存在'
    } else if (has.level <= this.admin[domain].level) {
      throw '无法修改同级或高级管理员'
    }

    //await db.admin.update({ cardnum: admin.cardnum, domain }, admin)
    await adminCollection.updateOne({ cardnum: admin.cardnum, domain }, { $set: admin })
    return 'OK'
  },

  /**
  * api {DELETE} /api/admin/admin
  * 删除管理员
  * apiParam { domain, cardnum }
  */
  async delete({ domain, cardnum }) {
    let adminCollection = await mongodb('herald_admin')
    // 只允许同域任免
    if (!this.admin[domain]) {
      throw 403
    }

    //let has = await db.admin.find({ cardnum, domain }, 1)
    let has = await adminCollection.findOne({ cardnum, domain })
    if (!has) {
      throw '管理员不存在'
    } else if (has.level <= this.admin[domain].level) {
      throw '无法删除同级或高级管理员'
    }

    //await db.admin.remove({ cardnum, domain })
    await adminCollection.deleteMany({ cardnum, domain })
    return 'OK'
  }
}
