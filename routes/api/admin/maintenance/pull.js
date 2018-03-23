const cp = require('child_process')
const exec = (command) => new Promise((resolve, reject) => {
  cp.exec(command, (err, stdout, stderr) => {
    if (err) {
      reject(err)
    } else {
      resolve({ stdout: stdout.trim(), stderr: stderr.trim() })
    }
  })
})

exports.route = {
  async get() {
    if (!this.admin.maintenance) {
      throw 403
    }
    let res1 = await exec('git pull; yarn')
    return
  }
}
