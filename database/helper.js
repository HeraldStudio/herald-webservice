const { Database } = require('sqlite3')

// 对 Database 异步函数进行 async 封装
;['run', 'get', 'all'].map (k => {
  [Database.prototype['_' + k], Database.prototype[k]]
    = [Database.prototype[k], function(sql, param) {
      return new Promise((resolve, reject) => {
        this['_' + k](sql, param || [], (err, res) => {
          err ? reject(err) : resolve(res)
        })
      })
    }]
})

module.exports = function(name) {
  return new Database(`database/${name}.db`)
}
