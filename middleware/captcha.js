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

let library_active = false;
let jwc_active = false;

const library_process = spawn('/usr/local/bin/anaconda3/envs/captcha/bin/python', [process.cwd() + '/middleware/captcha_childprocess/libcaptcha.py']);
const jwc_process = spawn('/usr/local/bin/anaconda3/envs/captcha/bin/python', [process.cwd() + '/middleware/captcha_childprocess/jwccaptcha.py']);

jwc_process.stdout.on('data', (chunk) => {
  "use strict";
  let message = chunk.toString();
  message = message.substr(0, message.length-1);
  if (message === 'loaded') {
     console.log('教务处验证码模型加载成功');
    jwc_active = true;
  } else {
    try {
      message = JSON.parse(message);
      let job = captchaJobPool[message.path];
      let result = message.result;
      job.resolve(result)
    } catch (e) {}
  }
});

library_process.stdout.on('data', (chunk) => {
  "use strict";
  let message = chunk.toString();
  message = message.substr(0, message.length-1);
  if (message === 'loaded') {
    console.log('图书馆验证码模型加载成功');
    library_active = true;
  } else {
    try {
      message = JSON.parse(message);
      let job = captchaJobPool[message.path];
      let result = message.result;
      job.resolve(result)
    } catch (e) {}
  }
});


jwc_process.stdin.on('error', (err) => {
  "use strict";
  console.log(err);
});

library_process.stdin.on('error', (err) => {
  "use strict";
  console.log(err);
});

const generateName = () => {
  return Math.random().toString(36).substr(2)
};

const jwcCaptcha = async (ctx) => {
  let pic = Buffer.from((await ctx.get('http://xk.urp.seu.edu.cn/studentService/getCheckCode')).data);
  return new Promise((resolve, reject) => {
      let picName = `./captcha_temp/${generateName()}.jpg`;
      fs.writeFile(picName, pic, (err) => {
        "use strict";
        if (err || !jwc_active) { reject(Error('fail_to_get_captcha'))} else {
          jwc_process.stdin.write(picName + '\n');
          captchaJobPool[picName] = {resolve, reject}
        }
      });
  });
};

const libraryCaptcha = async (ctx) => {
  let pic = Buffer.from((await ctx.get('http://www.libopac.seu.edu.cn:8080/reader/captcha.php')).data);
  return new Promise((resolve, reject) => {
    let picName = `./captcha_temp/${generateName()}.png`;
    fs.writeFile(picName, pic, (err) => {
      "use strict";
      if (err || !jwc_active) { reject(Error('fail_to_get_captcha'))} else {
        library_process.stdin.write(picName + '\n');
        captchaJobPool[picName] = {resolve, reject}
      }
    });
  });
};

module.exports = async (ctx, next) => {
  ctx.jwcCaptcha = () => { return Promise.race([jwcCaptcha(ctx), new Promise((resolve, reject) => {setTimeout(reject, 3000)})]) };
  ctx.libraryCaptcha = () => {return Promise.race([libraryCaptcha(ctx), new Promise((resolve, reject) => {setTimeout(reject, 3000)})]) };
  await next()
};
