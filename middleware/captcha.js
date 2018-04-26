const procmon = require('../worker/procmon')
const fs = require('fs')

module.exports = ({ python }) => {
  const captchaJobPool = {}
  let libraryActive = false

  const libraryProcess = new procmon(python, [
    process.cwd() + '/worker/captcha/libcaptcha.py'
  ], {
    maxCpu: 50,
    autoReload: true,
    onBind: proc => {
      proc.stdout.on('data', (chunk) => {
        "use strict";
        let message = chunk.toString();
        message.trim().split('\n').map(message => {
          if (message === 'loaded') {
            libraryActive = true
          } else {
            try {
              message = JSON.parse(message)
              let job = captchaJobPool[message.path]
              delete captchaJobPool[message.path]
              let result = message.result
              job.resolve(result)
            } catch (e) {}
          }
        })
      })
    }
  })

  libraryProcess.start()

  const generateName = () => {
    return Math.random().toString(36).substr(2)
  }

  const libraryCaptcha = async ctx => {
    let pic = Buffer.from((await ctx.get('http://www.libopac.seu.edu.cn:8080/reader/captcha.php')).data);
    return new Promise((resolve, reject) => {
      let picName = `/tmp/ws3-captcha-${generateName()}.png`;
      fs.writeFile(picName, pic, err => {
        "use strict";
        if (err || !libraryActive) {
          reject(err || Error('Failed to get captcha'))
        } else {
          libraryProcess.process.stdin.write(picName + '\n');
          captchaJobPool[picName] = {resolve, reject}
        }
      })
    })
  }

  return async (ctx, next) => {
    ctx.libraryCaptcha = () => Promise.race([
      libraryCaptcha(ctx),
      new Promise((_, reject) => setTimeout(() => reject('验证码解析失败'), 3000))
    ])
    await next()
  }
}
