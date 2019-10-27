const nodemailer = require('nodemailer')
const emailConfig = (require('./sdk.json')).email
const smtpTransport = require('nodemailer-smtp-transport')
const wellknown = require('nodemailer-wellknown')

let morningExerciseConfig = wellknown('QQ')

try {
  morningExerciseConfig.auth = emailConfig.morningExercise.auth

} catch (e) {
  console.log('跑操提醒邮件账户未配置')
}

const morningExerciseEmailTransporter = nodemailer.createTransport(smtpTransport(morningExerciseConfig))
module.exports = { morningExerciseEmailTransporter } 
