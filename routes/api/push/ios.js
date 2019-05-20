const cheerio = require('cheerio')
const mongodb = require('../../../database/mongodb')
exports.route = {

    /**
    * GET /api/push/ios
    * 个人考试信息查询
    **/

    async get() {
        throw "POST ONLY"
    },

    async post({deviceToken}){
        let { cardnum } = this.user
        let tokenCollection = await mongodb('herald_ios_device_token')
        await tokenCollection.deleteMany({cardnum})
        await tokenCollection.insertOne({cardnum, deviceToken})
        console.log({cardnum, deviceToken})
        return 'OK'
    }
}
