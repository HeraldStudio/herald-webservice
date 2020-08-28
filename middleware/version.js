module.exports = async (ctx, next) => {
  if (ctx.path === '/app-download') {
    if (ctx.request.headers['user-agent'].toLowerCase().includes('ios') || ctx.request.headers['user-agent'].toLowerCase().includes('mac')) {
      ctx.redirect('https://apps.apple.com/cn/app/id1378941139')
    } else {
      if (ctx.request.headers['user-agent'].toLowerCase().includes('micromessenger')) {
        ctx.type = 'text/html;charset=utf-8'
        ctx.body = require('../assets/wechatTip')
        return
      } else {
        let record = await ctx.db.execute(`
        SELECT DOWNLOAD_URL
        FROM H_VERSION
        WHERE CREATEDTIME IN (
          SELECT MAX(CREATEDTIME)
          FROM H_VERSION
          WHERE PLATFORM = 'app-android'
        )AND PLATFORM = 'app-android'
        `)
        ctx.redirect(record.rows[0][0])
      }
    }
  } else {
    await next()
  }
}