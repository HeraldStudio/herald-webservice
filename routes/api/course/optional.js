const { config } = require('../../../app')
const db = require('../../../database/course')

/**
 * 选修课统计信息的查询（课表预测）
 */
exports.route = {
  async get({ page = 1, pagesize = 10 }) {
    return await this.publicCache('1d', async () => {
      return (await db.course.find({
        courseType: { $ne: '' },
        avgScore: { $gt: 0 }
      }, pagesize, (page - 1) * pagesize, 'avgScore-')).map(k => {
        k.avgScore = Math.round(k.avgScore)
        return k
      })
    })
  }
}