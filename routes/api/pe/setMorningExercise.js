const mongodb = require('../../../database/mongodb')
const crypto = require('crypto')

exports.route = {
  async get({sessionKey, state}) {
    let col = await mongodb('herald_morning_exercise')
    let md5 = crypto.createHash('md5');
    let sessionKeyMd5 = md5.update(sessionKey).digest('hex');
    let date = moment().format('YYYY-MM-DD')
    let record = await col.findOne({date, sessionKeyMd5})

    if(!record){
        throw '非法访问'
    }
    
    await col.updateMany({date},{$set:{state}})
    record = await col.findOne({date})
    return record.state === 'set' ? '已设定发布跑操预报':'已取消跑操预报'
  }
}