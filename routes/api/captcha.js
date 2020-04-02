const svgCaptcha = require('svg-captcha')
const uuid = require('uuid/v4')
const moment = require('moment')
const crypto = require('crypto')

const expire = 5 * 60 * 1000

const hash = value => {
  return Buffer.from(crypto.createHash('sha256').update(value).digest()).toString('hex')
}

exports.route = {

  /**
    * GET /api/captcha
    * 获取验证码
    **/
  async get() {
    const expireTime = +moment() + expire

    let captcha = svgCaptcha.create()
    let token = uuid()

    try{
      await this.db.execute(`
    INSERT INTO TOMMY.H_CAPTCHA
    (CAPTCHA_HASH, CAPTCHA_TEXT, EXPIRE_TIME)
    VALUES (:captchaHash, :captchaText, :expireTime)`
      ,{
        captchaHash: hash(token),
        captchaText: captcha.text,
        expireTime: moment(expireTime).toDate()
      })

      return {
        id: token,
        captcha: captcha.data
      }
    }catch(e){
      throw('验证码出错')
    }
  
    

  },
  
}