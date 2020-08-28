module.exports = async (ctx, next) => {
  if (ctx.path === '/app-download/android') {
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
  } else {
    await next()
  }
}