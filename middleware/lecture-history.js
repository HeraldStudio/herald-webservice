let lectureMap = {}
let lastInvokeTime = 0

module.exports = async (ctx, next) => {
  let now = moment()
  // 每24小时更新一次
  if (now - lastInvokeTime >= 24 * 60 * 60 * 1000) {
    lastInvokeTime = now
    lectureMap = {}
    let record = await ctx.db.execute(`
      SELECT NAME, DATESTR, LOCATION, URL
      FROM H_LECTURE_HISTORY
    `)
    record.rows.forEach(r => {
      if (!lectureMap[r[1]]) {
        lectureMap[r[1]] = {}
      }
      if (!lectureMap[r[1]][r[2]]) {
        lectureMap[r[1]][r[2]] = []
      }
      const [name, dateStr, location, url] = r
      lectureMap[r[1]][r[2]].push({name, dateStr, location, url})
    })
  }
  ctx.lectureMap = lectureMap
  await next()
  return
}