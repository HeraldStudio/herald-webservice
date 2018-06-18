const qiniu = require('qiniu')
const config = require('./sdk.json')
const crypto = require('crypto')

exports.getUptoken = () => {
  let { access, secret, bucket } = config.qiniu
  let key = Buffer.from(crypto.randomBytes(16)).toString('hex')
  let mac = new qiniu.auth.digest.Mac(access, secret)
  let uptoken = new qiniu.rs.PutPolicy({
    scope: bucket + ':' + key,
    saveKey: key,
    fsizeLimit: 1024 * 1024, // 限制1MB以内
    returnBody: `{"url":"http://static.myseu.cn/${key}"}`
  }).uploadToken(mac)

  return { key, uptoken }
}
