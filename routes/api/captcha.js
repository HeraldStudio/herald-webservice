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
    
    let captcha
    // eslint-disable-next-line no-constant-condition
    if(expireTime % 3 === 1 || expireTime % 3 === 2 || true ){
      captcha = svgCaptcha.create({
        size:5,
        ignoreChars:'0oiIl1OZ52Sz',
        noise:3,
        color: false,
      })
    }else{
      captcha = svgCaptcha.createMathExpr({
        mathMin : 34,
        mathMax : 374,
        mathOperator : '+-'
      })
    }

    let token = uuid()

    try{
      await this.db.execute(`
      INSERT INTO TOMMY.H_CAPTCHA
      (CAPTCHA_HASH, CAPTCHA_TEXT, EXPIRE_TIME)
      VALUES (:captchaHash, :captchaText, :expireTime)`
      ,{
        captchaHash: hash(token),
        captchaText: captcha.text.toUpperCase(),
        expireTime
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