// const mongodb = require('../../../database/mongodb')
// const { pushApnByCardnum } = require('../../../sdk/apn')
exports.route = {

  /**
    * GET /api/push/ios
    * 个人考试信息查询
    **/

  async get() {
    //return await pushApnByCardnum('213163355', 'Tonight rain and wind go,', ' Sleep can\'t kill the alcohol')
  },

  async post({deviceToken}){
    // let { cardnum } = this.user
    // let tokenCollection = await mongodb('herald_ios_device_token')
    // await tokenCollection.deleteMany({cardnum})
    // await tokenCollection.insertOne({cardnum, deviceToken})
    // console.log({cardnum, deviceToken})
    // return 'OK'
  }
}
