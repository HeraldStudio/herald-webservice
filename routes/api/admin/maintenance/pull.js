const cp = require('child_process')
const exec = (command) => new Promise((resolve, reject) => {
  cp.exec(command, (err, stdout, stderr) => {
    if (err) {
      reject(err)
    } else {
      resolve([stdout, stderr].map(k => k.trim()).filter(k => k).join('\n'))
    }
  })
})

exports.route = {
  async get() {
    if (!this.admin || !this.admin.maintenance) {
      throw 403
    }
    let res1 = await exec('git pull; yarn')
    if (/fatal:/.test(res1)) {
      throw 'Git 出现错误，请登录控制台检查'
    }
    return
  }
}
