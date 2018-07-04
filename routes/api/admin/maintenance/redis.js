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
    if (!this.admin || !this.admin.maintenance) {
      throw 403
    }
    let secret = require('./redis-secret.json')
    let { stdout } = await exec(`redis-cli -h ${secret.host} -p ${secret.port} -a ${secret.password} info`)
    let result = {}

    // 将 redis 状态解析为对象
    stdout.replace(/\r/g, '').split(/\n{2,}/g)
      .map(section => section.trim().split('\n'))
      .map(section => {
        let title = section.shift().replace(/^#\s+/, '').toLowerCase().replace(/\s\S/g, k => k[1].toUpperCase())
        let sectionObj = {}
        section.map(row => {
          let [key, value] = row.split(':')
          key = key.replace(/_./g, k => k[1].toUpperCase())
          if (/^[^,=]+=[^,=]+(,[^,=]+=[^,=]+)*$/.test(value)) {
            let valueObj = {}
            value.split(',').map(part => {
              let [k, v] = part.split('=')
              k = k.replace(/_./g, j => j[1].toUpperCase())
              valueObj[k] = v
            })
            value = valueObj
          }
          sectionObj[key] = value
        })
        result[title] = sectionObj
      })

    return result
  }
}
