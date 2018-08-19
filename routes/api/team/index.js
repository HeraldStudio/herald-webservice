const { config } = require('../../../app')
const db = require('../../../database/team')
const crypto = require('crypto')

/**
 * team api 竞赛组队API
 */
exports.route = {

  async get({ page = 1, pagesize = 10, own = false }) {
    
    let now = +moment()
    let amount = await db.team.count('*', { expireTime: {$lt: now} }) // 获取当前未过期的队伍总数
    let { cardnum } = this.user

    let teams

    if (own) {
        teams = await db.team.find({ expireTime: {$lt: now} , organizer: cardnum}, 
            pagesize, (page - 1) * pagesize, 'updateTime')
    } else {
        teams = await db.team.find({ expireTime: {$lt: now} }, 
            pagesize, (page - 1) * pagesize, 'updateTime')
    }
    
    return { amount, teams }

  },

  async post({ teamName, capacity, description, expireTime }) {
    
    let now = +moment()

    let { cardnum, name } = this.user
    // 通过 队长一卡通号 队伍名称 队伍描述 生成时间 计算tid
    let tid = crypto.createHash('sha256')
    tid.update( teamName )
    tid.update( description )
    tid.update( '' + now ) 
    tid.update( cardnum )
    tid = tid.digest( 'hex' )

    let success

    try {
      await db.team.insert(
            {
              tid,
              teamName,
              capacity,
              organizer: cardnum,
              expireTime,
              updateTime: now,
              description
            }
        )
        return '队伍建立成功'
    } catch(e) {
        throw '队伍建立失败'
    }

    return { success }
  },

  async put({ tid, capacity=0, description='' }) {

    let team = await db.team.find({ tid })
    let { cardnum } = this.user
    let updateTime = +moment()

    if ( team.organizer === cardnum ) {
      try {
        if (capacity) {
          await db.team.update({ tid }, { capacity, updateTime })
        }
        if (description) {
          await db.team.update({ tid }, { description, updateTime })
        }
      } catch(e) {
        throw '数据库错误'
      }
    } else {
      throw 403
    }
  }, 

  async delete({ tid }) {
    let team = await db.team.find({ tid })
    let { cardnum } = this.user

    if ( team.organizer === cardnum ) {
      try {
        await db.team.delete({ tid })
      } catch(e) {
        throw '数据库错误'
      }
    } else {
      throw 403
    }
  }
}