const { spawn } = require('child_process');
const axios = require('axios');
const chardet = require('chardet');
const iconv = require('iconv');
const fs = require('fs');
const onDeath = require('death');

module.exports = ({ python }) => {
  const captchaJobPool = {};

  let libraryActive = false;
  let jwcActive = false;

  const libraryProcess = spawn(python, [
    process.cwd() + '/middleware/captcha-childprocess/libcaptcha.py'
  ]);
  const jwcProcess = spawn(python, [
    process.cwd() + '/middleware/captcha-childprocess/jwccaptcha.py'
  ]);

  onDeath(() => {
    libraryProcess.kill()
    jwcProcess.kill()
  })

  jwcProcess.stdout.on('data', (chunk) => {
    "use strict";
    let message = chunk.toString();
    message.trim().split('\n').map(message => {
      if (message === 'loaded') {
        console.log('[python] 教务处验证码模型加载成功');
        jwcActive = true;
      } else {
        try {
          message = JSON.parse(message);
          let job = captchaJobPool[message.path];
          delete captchaJobPool[message.path];
          let result = message.result;
          job.resolve(result)
        } catch (e) {}
      }
    })
  });

  libraryProcess.stdout.on('data', (chunk) => {
    "use strict";
    let message = chunk.toString();
    message.trim().split('\n').map(message => {
      if (message === 'loaded') {
        console.log('[python] 图书馆验证码模型加载成功');
        libraryActive = true;
      } else {
        try {
          message = JSON.parse(message);
          let job = captchaJobPool[message.path];
          delete captchaJobPool[message.path];
          let result = message.result;
          job.resolve(result)
        } catch (e) {}
      }
    })
  });

  const handleError = err => {
    err.toString().split('\n')
      .map(k => k.trim())
      .filter(k => k)
      .filter(k => !/WARNING/.test(k))
      .map(k => console.log('[python]', k))
  }

  jwcProcess.stderr.on('data', handleError);
  libraryProcess.stderr.on('data', handleError);

  const generateName = () => {
    return Math.random().toString(36).substr(2)
  };

  const jwcCaptcha = async ctx => {

    let pic = Buffer.from((await ctx.get('http://xk.urp.seu.edu.cn/studentService/getCheckCode')).data);
    return new Promise((resolve, reject) => {
      let picName = `/tmp/ws3-captcha-${generateName()}.jpg`;
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
      let picName = `/tmp/ws3-captcha-${generateName()}.png`;
      fs.writeFile(picName, pic, err => {
        "use strict";
        if (err || !libraryActive) {
          reject(err || Error('Failed to get captcha'))
        } else {
          libraryProcess.stdin.write(picName + '\n');
          captchaJobPool[picName] = {resolve, reject}
        }
      });
    });
  };

  return async (ctx, next) => {
    ctx.jwcCaptcha = () => Promise.race([
      jwcCaptcha(ctx),
      new Promise((_, reject) => setTimeout(() => reject('验证码解析失败'), 3000))
    ])
    ctx.libraryCaptcha = () => Promise.race([
      libraryCaptcha(ctx),
      new Promise((_, reject) => setTimeout(() => reject('验证码解析失败'), 3000))
    ])
    await next()
  };
}
