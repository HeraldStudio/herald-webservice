/**
 * Created by WolfTungsten on 2018/3/15.
 */
/**
 * Created by WolfTungsten on 2018/2/16.
 */
const { spawn } = require('child_process');
const axios = require('axios');
const chardet = require('chardet');
const iconv = require('iconv');
const fs = require('fs');
const captchaJobPool = {};

let libraryActive = false;
let jwcActive = false;

const libraryProcess = spawn('/usr/local/bin/anaconda3/envs/captcha/bin/python', [
  process.cwd() + '/middleware/captcha-childprocess/libcaptcha.py'
]);
const jwcProcess = spawn('/usr/local/bin/anaconda3/envs/captcha/bin/python', [
  process.cwd() + '/middleware/captcha-childprocess/jwccaptcha.py'
]);

jwcProcess.stdout.on('data', (chunk) => {
  "use strict";
  let message = chunk.toString();
  message = message.substr(0, message.length-1);
  if (message === 'loaded') {
     console.log('教务处验证码模型加载成功');
    jwcActive = true;
  } else {
    try {
      message = JSON.parse(message);
      let job = captchaJobPool[message.path];
      let result = message.result;
      job.resolve(result)
    } catch (e) {}
  }
});

libraryProcess.stdout.on('data', (chunk) => {
  "use strict";
  let message = chunk.toString();
  message = message.substr(0, message.length-1);
  if (message === 'loaded') {
    console.log('图书馆验证码模型加载成功');
    libraryActive = true;
  } else {
    try {
      message = JSON.parse(message);
      let job = captchaJobPool[message.path];
      let result = message.result;
      job.resolve(result)
    } catch (e) {}
  }
});


jwcProcess.stdin.on('error', (err) => {
  "use strict";
  console.log(err);
});

libraryProcess.stdin.on('error', (err) => {
  "use strict";
  console.log(err);
});

const generateName = () => {
  return Math.random().toString(36).substr(2)
};

const jwcCaptcha = async ctx => {
  let pic = Buffer.from((await ctx.get('http://xk.urp.seu.edu.cn/studentService/getCheckCode')).data);
  return new Promise((resolve, reject) => {
    let picName = `./captcha-temp-${generateName()}.jpg`;
    fs.writeFile(picName, pic, err => {
      "use strict";
      if (err || !jwcActive) {
        reject(err || Error('Failed to get captcha'))
      } else {
        jwcProcess.stdin.write(picName + '\n');
        captchaJobPool[picName] = {resolve, reject}
      }
    });
  });
};

const libraryCaptcha = async ctx => {
  let pic = Buffer.from((await ctx.get('http://www.libopac.seu.edu.cn:8080/reader/captcha.php')).data);
  return new Promise((resolve, reject) => {
    let picName = `./captcha-temp-${generateName()}.png`;
    fs.writeFile(picName, pic, err => {
      "use strict";
      if (err || !jwcActive) {
        reject(err || Error('Failed to get captcha'))
      } else {
        libraryProcess.stdin.write(picName + '\n');
        captchaJobPool[picName] = {resolve, reject}
      }
    });
  });
};

module.exports = async (ctx, next) => {
  ctx.jwcCaptcha = () => Promise.race([
    jwcCaptcha(ctx),
    new Promise((_, reject) => setTimeout(reject, 3000))
  ])
  ctx.libraryCaptcha = () => Promise.race([
    libraryCaptcha(ctx),
    new Promise((_, reject) => setTimeout(reject, 3000))
  ])
  await next()
};
