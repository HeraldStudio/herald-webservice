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
    let res1 = await exec('git pull')
    let { stdout, stderr } = res1
    let changed = stdout !== 'Already up-to-date.'
    if (changed) {
      let res2 = await exec('yarn')
      stdout = [stdout, res2.stdout].join('\n').trim()
      stderr = [stderr, res2.stderr].join('\n').trim()
    }
    let out = (stdout + '\n' + stderr).trim()
    if (changed && this.admin.super) {
      throw 401
    }
    return { changed, out }
  }
}
