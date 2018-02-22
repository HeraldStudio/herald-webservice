const control = require('../../../control')

exports.route = {
  async get() {
    if (!this.admin.maintenance) {
      throw 403
    }
    let { stdout } = await control.exec('redis-cli info')
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
