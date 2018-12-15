const cheerio = require('cheerio')
const mongodb = require('../../database/mongodb')
exports.route = {

    /**
    * GET /api/exam
    * 个人考试信息查询
    **/

    async get() {
        let cetCollection = await mongodb('herald_cet')
        return await this.userCache('10m', async () => {
            let { name, cardnum, schoolnum } = this.user
            await this.useEHallAuth('5226570836424975')
            let res = await this.post('http://ehall.seu.edu.cn/publicapp/sys/sljzkzdy/modules/ksxxhd/T_KSBM_ZKZDY_QUERY.do', { XH: cardnum })
            if (res.data && res.data.datas.T_KSBM_ZKZDY_QUERY.rows && res.data.datas.T_KSBM_ZKZDY_QUERY.rows[0]) {
                // 存在查询信息，更新数据库记录
                await cetCollection.deleteMany({XH:cardnum})
                let cetInfo = res.data.datas.T_KSBM_ZKZDY_QUERY.rows[0]
                await cetCollection.insertOne(cetInfo)
                return cetInfo
            } else {
                // 官网不存在，从数据库查询
                let cetInfo = await cetCollection.findOne({XH:cardnum})
                if (cetInfo) {
                    return cetInfo
                }
                // 数据库没有
                throw '没有CET报名信息'
            }
        })
    }
}
