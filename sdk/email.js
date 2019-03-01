const nodemailer = require('nodemailer');
const emailConfig = (require('./sdk.json')).email
const smtpTransport = require('nodemailer-smtp-transport');
const wellknown = require("nodemailer-wellknown");

let morningExerciseConfig = wellknown("QQ");
morningExerciseConfig.auth = emailConfig.morningExercise.auth

const morningExerciseEmailTransporter = nodemailer.createTransport(smtpTransport(morningExerciseConfig));

module.exports = { morningExerciseEmailTransporter } 
