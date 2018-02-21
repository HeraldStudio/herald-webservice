const db = require('sqlongo')('admin')
const chalk = require('chalk')
const crypto = require('crypto')

// 程序启动时，生成超级管理员 Token
// 为了防止与普通用户碰撞，此处字节数跟普通用户 token 字节数做区分，切勿轻易改成跟普通用户长度相同，否则会有问题
const superToken = new Buffer(crypto.randomBytes(16)).toString('hex')
console.log('本次会话的超级管理员 Token 为：' + chalk.blue(superToken) + '，请妥善保管')

;(async () => {
  await db.admin.define({
    cardnum:    'text not null',  // 管理员一卡通号，一个人可以为多个管理员，所以可重复
    name:       'text not null',  // 管理员姓名
    phone:      'text not null',  // 管理员电话
    domain:     'text not null',  // 管理员权限域
    level:      'int not null',   // 管理员权限等级
    authorized: 'int not null',   // 管理员被授权时间
    last_used:  'int not null'    // 管理员最后调用时间
  })

  await db.domain.define({
    domain: 'text primary key',   // 管理员权限域
    name:   'text not null',      // 管理员权限域中文名
    desc:   'text not null'       // 管理员权限域职责说明
  })

  const define = async (domain, name, desc) => {
    if (domain === 'super') {
      throw 'super 为保留域'
    }

    if (await db.domain.find({ domain }, 1)) {
      return
    }

    await db.domain.insert({ domain, name, desc })
  }

  require('./admin.json').map(k => {
    let { domain, name, desc } = k
    define(domain, name, desc)
  })
})()

module.exports = async (ctx, next) => {

  // 中间件处理，允许下游查询当前用户的权限
  ctx.admin = { super: false }
  if (ctx.request.headers.token === superToken) {
    ctx.admin.super = true
    let domains = await db.domain.find()
    for (let domain of domains) {
      ctx.admin[domain.domain] = {
        domain: domain.name,
        desc: domain.desc,
        level: 0
      }
    }
  } else if (ctx.request.headers.token.length === superToken.length) {
    // 若 token 与超管 token 长度相同但不是超管 token，认为是老超管登录过期
    ctx.throw(401)
  } else if (ctx.user.isLogin) {
    let { cardnum } = ctx.user
    let admins = await db.admin.find({ cardnum })
    for (let admin of admins) {
      let domain = admin.domain
      let domainInfo = await db.domain.find({ domain }, 1)
      admin.domain = domainInfo.name
      admin.desc = domainInfo.desc
      ctx.admin[domain] = admin
    }

    // 利用 Proxy 机制，每当 get 某个 domain 权限时，自动更新数据库中的调用时间
    ctx.admin = new Proxy(ctx.admin, {
      set(target, key, value) {
        target[key] = value
        return true
      },
      get(target, key) {
        if (target[key]) {
          let now = new Date().getTime()
          let domain = key
          db.admin.update({ cardnum, domain }, { last_used: now })
        }
        return target[key]
      }
    })
  }

  if (ctx.path === '/admin/domain') {
    let method = ctx.method.toLowerCase()
    if (!ctx.admin.super) {
      throw 403
    }

    /**
     * api {GET} /admin/domain
     *
     * 获取所有权限域
     */
    if (method === 'get') {
      ctx.body = await db.domain.find()
      return
    }

    /**
     * POST /admin/domain
     * 新建权限域
     * apiParam { domain: { domain, name, desc } }
     */
    if (method === 'post') {
      let { domain } = ctx.params
      if (domain === 'super') {
        throw 'super 为保留域'
      }

      if (await db.domain.find({ domain }, 1)) {
        throw '权限域已存在'
      }

      await db.domain.insert(domain)
      ctx.body = 'OK'
      return
    }

    /**
     * PUT /admin/domain
     * 修改权限域
     * apiParam { domain: { domain, name, desc } }
     */
    if (method === 'put') {
      let { domain } = ctx.params

      // 恶魔妈妈摸妹妹
      await db.domain.update({ domain: domain.domain }, domain)

      ctx.body = 'OK'
      return
    }

    /**
     * DELETE /admin/domain
     * 删除权限域
     * apiParam domain
     */
    if (method === 'delete') {
      let { domain } = ctx.params
      await db.domain.remove({ domain })
      await db.admin.remove({ domain })
      ctx.body = 'OK'
      return
    }
  } else if (ctx.path === '/admin') {
    let method = ctx.method.toLowerCase()

    /**
     * GET /admin
     * 查询管理员二合一接口
     * 带 domain 参数表示查询指定域下的管理员；不带 domain 参数表示查询自己的管理员身份
     */
    if (method === 'get') {
      let { domain } = ctx.params
      if (!domain) {
        ctx.body = ctx.admin
      } else {
        // 只允许当前域中的管理员和超级管理员查看当前域中的管理员
        if (!ctx.admin[domain]) {
          throw 403
        }

        ctx.body = {
          domain: await db.domain.find({ domain }, 1),
          admins: await db.admin.find({ domain })
        }
      }
      return
    }

    /**
     * POST /admin
     * 任命管理员
     * apiParam { domain, admin: { name, cardnum, phone } }
     */
    if (method === 'post') {
      let { domain, admin } = ctx.params
      let { name, cardnum, phone } = admin

      // 只允许同域任命
      if (!ctx.admin[domain]) {
        throw 403
      }

      let has = await db.admin.find({ cardnum, domain }, 1)
      if (has) {
        throw '管理员已存在'
      }

      let now = new Date().getTime()
      await db.admin.insert({
        cardnum, name, phone, domain,
        level: ctx.admin[domain].level + 1,
        authorized: now,
        last_used: now
      })
      ctx.body = 'OK'
      return
    }

    /**
     * DELETE /admin
     * 删除管理员
     * apiParam { domain, cardnum }
     */
    if (method === 'delete') {
      let { domain, cardnum } = ctx.params

      // 只允许同域任免
      if (!ctx.admin[domain]) {
        throw 403
      }

      let has = await db.admin.find({ cardnum, domain }, 1)
      if (!has) {
        throw '管理员不存在'
      } else if (has.level <= ctx.admin[domain].level) {
        throw '无法删除同级或高级管理员'
      }

      await db.admin.remove({ cardnum, domain })
      ctx.body = 'OK'
      return
    }
  } else {
    await next()
  }
}
