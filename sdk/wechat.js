const { config } = require('../app')
// const mongodb  = require('../database/mongodb')

const axios = require('axios').create({
  baseURL: 'https://api.weixin.qq.com/cgi-bin/',
  ...config.axios
})
const { wechat } = require('./sdk.json')
const oracle = require('../database/oracle')

/**
 * 出现了个很尴尬的问题，只有在路由和中间键才能访问数据库。
 * 
 */

const getToken = async (type) => {
  let token, expire = 0
  const db = await oracle.getConnection()
  let record = await db.execute(`
  SELECT TOKEN, EXPIRES_IN
  FROM H_ACCESS_TOKEN
  WHERE TYPE =:type
  `, { type })
  if (record.rows.length !== 0) {
    token = record.rows[0][0]
    expire = record.rows[0][0]
  }
  let now = +moment()
  if (expire > now) {
    db.close()
    return token
  }

  let { data: { access_token, expires_in } } = await axios.get(
    '/token?grant_type=client_credential' +
    `&appid=${wechat[type].appid}&secret=${wechat[type].appsecret}`
  )
  if (!access_token) {
    throw '接口调用失败' // 可能是当前 IP 不在白名单，需要管理员到公众号后台添加当前服务器或测试机 IP 到白名单
  }
  try {
    db.execute(`
    INSERT INTO H_ACCESS_TOKEN (TYPE, TOKEN, EXPIRES_IN)
    VALUES (:type, :access_token, :expire)
    `, { type, access_token, expire: now + expires_in * 1000 })
  } catch (err) {
    if (err.errorNum === 1) {
      console.log(err)
      throw '数据库错误'
    } else {
      db.execute(`
      UPDATE H_ACCESS_TOKEN
      SET TOKEN =:access_token , EXPIRES_IN =:expire
      WHERE TYPE =:type
      `, { access_token, expire: now + expires_in * 1000, type })
    }
  }
  db.close()
  return access_token
}

const getAxios = (type) => {
  let ret = {}
  'get,post,put,delete'.split(',').map(k => {
    ret[k] = async (path, ...args) => {
      let token = await getToken(type)
      path = path.split('#')
      path[0] += (~path.indexOf('?') ? '&' : '?') + 'access_token=' + token
      path = path.join('#')
      return await axios[k](path, ...args)
    }
  })
  return ret
}

module.exports = {
  getToken, getAxios
}