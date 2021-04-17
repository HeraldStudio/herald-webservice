let lectureMap = {}
// 表示是否对lectureMap初始化, 0为未初始化
let lectureInit = 0

// lectureMap为待更新的lectureMap
// dbconn为数据库连接
async function updateLectureMap(dbconn)  {
  lectureMap = {}
  let record = await dbconn.execute(`
      SELECT NAME, DATESTR, LOCATION, URL
      FROM H_LECTURE_HISTORY
      WHERE DELETED != 1
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

module.exports = async (ctx, next) => {
  // 初次启动时更新一次, 之后每次对讲座记录有修改时再更新
  if (lectureInit === 0) {
    lectureInit = 1
    await updateLectureMap(ctx.db)
  }
  ctx.lectureMap = lectureMap
  ctx.updateLectureMap = updateLectureMap
  await next()
  return
}