const cheerio = require('cheerio')
const ids = require('../../middleware/auth-provider/ids')

// 可申请奖学金、已申请奖学金、可申请助学金、已申请助学金的 URL 参数
// 原来为 base64 编码，此处解码书写，增加可读性
const [scholarshipList, scholarshipApplied, stipendList, stipendApplied] = [
  'f|com.wiscom.portal.site.v2.impl.FragmentWindow|f3409|view|normal|action=list', 
  'f|com.wiscom.portal.site.v2.impl.FragmentWindow|f3409|view|normal|action=appliedQuery', 
  'f|com.wiscom.portal.site.v2.impl.FragmentWindow|f2187|view|normal|action=list', 
  'f|com.wiscom.portal.site.v2.impl.FragmentWindow|f2187|view|normal|action=appliedQuery'
].map(k => Buffer.from(k).toString('base64').replace(/=/g, '_'))

exports.route = {
  async get() {
    return await this.userCache('1h', async () => {
      await this.useAuthCookie()
      let { cardnum, password } = this.user
      try {
        await ids(this, cardnum, password)
      } catch (e) {
        throw '登录信息门户出现问题，请手动登录信息门户 (my.seu.edu.cn) 后再试'
      }

      return Object.assign({}, ...await Promise.all(Object.entries({
        scholarshipList, scholarshipApplied, stipendList, stipendApplied
      }).map(async ([type, route]) => {
        await this.get(`http://my.seu.edu.cn/index.portal?.p=${route}`)
        let res = await this.get(`http://my.seu.edu.cn/index.portal?pageIndex=1&pageSize=1000&.p=${route}`)
        let $ = cheerio.load(res.data)
        return {
          [type]: $('.isp-service-item-info').toArray().map(k => $(k)).map(k => {
            try {
              let name = k.find('.jxjTitle').text()
              let entries = k.find('.jxjInfo').toArray().map(k => $(k).text().split('：')[1].trim())
              if (/\d+-\d+-\d+/.test(entries[0])) {
                let [datePeriod, level, yearPeriod, amount] = entries
                let [startDate, endDate] = datePeriod.match(/\d+-\d+-\d+/g).map(k => +moment(k))
                let [startYear, endYear] = yearPeriod.match(/\d+/g)
                amount = /\d+/.exec(amount)[0]
                return { name, level, startDate, endDate, startYear, endYear, amount }
              } else {
                let [level, yearPeriod, amount, state] = entries
                let [startYear, endYear] = yearPeriod.match(/\d+/g)
                amount = /\d+/.exec(amount)[0]
                return { name, level, startYear, endYear, amount, state }
              }
            } catch (e) {
              return null
            }
          }).filter(k => k)
        }
      })))
    })
  }
}