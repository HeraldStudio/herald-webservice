const crypto = require('crypto')
// 哈希算法，用于对 token 进行摘要
const hash = value => {
  return Buffer.from(crypto.createHash('sha256').update(value).digest()).toString('hex')
}
exports.route = {
  // 第三方应用通过持有的appid 与redirectUri 换取有效时间为3分钟的code
  async get({ appid, redirectUri }) {
    if (!appid || !redirectUri) {
      throw '参数不全'
    }
    console.log(appid, redirectUri)
    const { cardnum, name } = this.user
    let record = await this.db.execute(`
    SELECT URLPREFIX FROM H_OAUTH_WHITELIST
    WHERE APPID =:appid
    `, { appid })
    if (record.rows.length === 0) {
      throw 'invalid appid'
    }
    record = record.rows.map(Element => {
      let [urlPrefix] = Element
      return urlPrefix
    })
    for (let Element in record) {
      if (redirectUri.indexOf(record[Element]) === 0) {
        let code = Buffer.from(crypto.randomBytes(20)).toString('hex')
        let expiresAt = +moment().add(3, 'minutes')
        try {
          await this.db.execute(`
          INSERT INTO H_OAUTH_CODE (CODE, APPID, CARDNUM, NAME, EXPIRESAT)
          VALUES (:code, :appid, :cardnum, :name, :expiresAt)
          `, { code, appid, cardnum, name, expiresAt })
        } catch (err) {
          console.log(err)
          throw '数据库错误'
        }
        return {
          code
        }
      }
    }
    throw 'invalid redirectUrl'
  },
  // 第三方应用后端通过持有的appid, appSecret, code换取对应的用户身份
  async post({ appid, appSecret, code }) {
    if (!appid || !appSecret || !code) {
      throw '参数不全'
    }
    let record = await this.db.execute(`
    SELECT PLATFORM, CARDNUM, NAME
    FROM H_OAUTH_APP HOA
    LEFT JOIN H_OAUTH_CODE HOC
    ON HOA.APPID = HOC.APPID
    WHERE HOA.APPID =:appid AND APPSECRET =:appSecret AND EXPIRESAT >=:now
    `, { appid, appSecret, now: +moment() })
    if (record.rows.length !== 1) {
      throw 'invalid request'
    }
    const [platform, cardnum, name] = record.rows[0]

    try {
      await this.db.execute(
        `INSERT INTO TOMMY.H_OAUTH 
        (CARDNUM, NAME, CREATEDTIME, PLATFORM)
        VALUES (:cardnum, :name, :createdTime, :platform )
        `,
        {
          cardnum,
          name,
          createdTime: moment().toDate(),
          platform
        }
      )
    } catch (err) {
      console.log(err)
      throw '数据库错误'
    }
    return {
      cardnum
    }
  }
}