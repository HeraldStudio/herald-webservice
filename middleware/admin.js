/**
 * # 管理员权限中间件
 * 管理员身份表 H_ADMIN
 * 管理员权限表 H_ADMIN_PERMISSION
 * 
 * 暴露 ctx.hasPermission 接口，当需要使用权限时，直接传入所需权限的
 * 枚举值名称，若不具有对应权限就抛 403
 * 
 */
module.exports = async (ctx, next) => {

  // 中间件处理，允许下游查询当前用户的权限
  ctx.hasPermission = async ( permissionName ) => {
    if(!ctx.user.isLogin) {
      // 还没登录就访问？直接给你401
      throw 401
    }
    let { cardnum } = ctx.user
    let permissions = await ctx.db.execute(`
      SELECT p.PERMISSION 
      FROM TOMMY.H_ADMIN a, TOMMY.H_ADMIN_PERMISSION p 
      WHERE a.CARDNUM = b.CARDNUM AND a.CARDNUM = :cardnum`,
    { cardnum })

    permissions = permissions.rows.map(p => p[0])
    if(permissions.indexOf(permissionName) !== -1) {
      let now = moment()
      ctx.db.execute(`
              UPDATE TOMMY.H_ADMIN 
              SET LAST_INVOKED_TIME = :lastInvokedTime
              WHERE CARDNUM = :cardnum
              `, { lastInvokedTime: now.toDate(), cardnum })
      return true
    } else {
      throw 403
    }
  }
  await next()
}
