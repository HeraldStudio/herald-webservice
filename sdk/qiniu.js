const qiniu = require('qiniu')
const config = require('./sdk.json')
const crypto = require('crypto')

exports.getUptoken = (prefix = '') => {
  let { access, secret, bucket } = config.qiniu
  let key = prefix + (prefix ? '-' : '') + Buffer.from(crypto.randomBytes(16)).toString('hex')
  let mac = new qiniu.auth.digest.Mac(access, secret)
  let uptoken = (new qiniu.rs.PutPolicy({
    scope: bucket + ':' + key,
    saveKey: key,
    fsizeLimit: 1024 * 1024 * 5, // 限制5MB以内
    returnBody: `{"url":"https://static.myseu.cn/${key}"}`
  })).uploadToken(mac)

  return { key, uptoken }
}

exports.deleteFile = (url) => {
  let { access, secret, bucket } = config.qiniu
  let mac = new qiniu.auth.digest.Mac(access, secret)
  let _config = new qiniu.conf.Config()
  _config.zone = qiniu.zone.Zone_z0
  let bucketManager = new qiniu.rs.BucketManager(mac, _config)
  let key = url.replace('https://static.myseu.cn/', '')
  return new Promise((resolve, reject) => {
    bucketManager.delete(bucket, key, function (err, respBody) {
      if (err) {
        reject(err)
      } else {
        resolve(respBody)
      }
    })
  })
}
