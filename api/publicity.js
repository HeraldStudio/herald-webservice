const db = require('../database/publicity')

exports.route = {

  /**
   * GET /api/publicity
   * 获取有效内容（轮播图/通知/活动），并对当前用户标记为已读
   * @apiParam type banner/notice/activity
   **/
  async get () {
    let schoolnum = this.user.isLogin ? this.user.schoolnum : ''
    let identity = this.user.isLogin ? this.user.identity : ''
    let { type } = this.params

    let now = new Date().getTime()
    let criteria = type === 'activity' ? {
      type,
      startTime: { $lte: now },
      admittedBy: { $ne: '' }
    } : {
      type,
      startTime: { $lte: now },
      endTime: { $gt: now },
      admittedBy: { $ne: '' }
    }

    let selected = (await db.publicity.find(criteria)).filter(row =>
      schoolnum.indexOf(row.schoolnumPrefix === 0) // 手动过滤，符合学号前缀条件
    )

    if (identity) { // 游客不做统计，防止刷阅读量访问量
      selected = (await Promise.all(selected.map(async k => {
        let { pid } = k
        let has = await db.interaction.find({ pid, identity }, 1)
        k.liked = has.attitude === 1
        k.disliked = has.attitude === 2
        k.likeNum = await db.interaction.count({ pid, attitude: 1 })

        if (type === 'activity') {
          k.state = k.endTime > now ? 'ongoing' : 'ended'
        }

        if (!has) {
          await db.interaction.insert({ pid, identity, status: 1, attitude: 0, updateTime: now })
        }
        return k
      }))).filter(k => !k.disliked) // 过滤掉不感兴趣的内容
    }

    return selected
  },

  /**
   * POST /api/publicity
   * 对内容进行支持表态
   * @apiParam pid
   **/
  async post () {
    let { identity } = this.user
    let { pid } = this.params
    let publicity = await db.publicity.find({ pid })
    let now = new Date().getTime()

    if (publicity.startTime > now || publicity.endTime <= now) {
      throw '内容未开放或已过期'
    }

    let interaction = await db.interaction.find({ pid, identity }, 1)
    if (!interaction) {
      await db.interaction.insert({ pid, identity, status: 1, attitude: 1, updateTime: now })
    } else {
      await db.interaction.update({ pid, identity }, { attitude: 1, updateTime: now })
    }
  },

  /**
   * PUT /api/publicity
   * 报告内容已点击
   * @apiParam pid
   **/
  async put () {
    if (!this.user.isLogin) { // 对于未登录用户忽略请求
      return
    }

    let { identity } = this.user
    let { pid } = this.params
    let publicity = await db.publicity.find({ pid })
    let now = new Date().getTime()

    let interaction = await db.interaction.find({ pid, identity }, 1)
    if (!interaction) {
      await db.interaction.insert({ pid, identity, status: 2, attitude: 0, updateTime: now })
    } else {
      await db.interaction.update({ pid, identity }, { status: 2, updateTime: now })
    }
  },

  /**
   * DELETE /api/publicity
   * 对内容标记不感兴趣
   * @apiParam pid
   **/
  async delete () {
    let { identity } = this.user
    let { pid } = this.params
    let publicity = await db.publicity.find({ pid })
    let now = new Date().getTime()

    if (publicity.startTime > now || publicity.endTime <= now) {
      throw '内容未开放或已过期'
    }

    let interaction = await db.interaction.find({ pid, identity }, 1)
    if (!interaction) {
      await db.interaction.insert({ pid, identity, status: 1, attitude: 2, updateTime: now })
    } else {
      await db.interaction.update({ pid, identity }, { attitude: 2, updateTime: now })
    }
  }
}
