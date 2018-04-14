RegExp.escape = (s) => s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
const { search, cut } = require('./search/common')
const semaphore = require('await-semaphore')
const sem = new semaphore.Semaphore(10)
const threads = require('threads')

if (process.env.NODE_ENV === 'production') {
  threads.spawn('routes/api/search/worker')
}

exports.route = {
  async get({ q: query = '', page = 1, pagesize = 10 }) {
    let result = await search(query, page, pagesize)
    if (result.rows) {
      let queryRegify = cut(query).map(RegExp.escape).join('|')
      let queryReg = new RegExp(queryRegify, 'img')
      let queryContextReg = new RegExp('([\\s\\S]{0,20})(' + queryRegify + ')([\\s\\S]{0,80})', 'img')
      result.rows.forEach(row => {
        row.content = row.title + ' ' + row.content
        let appears = (row.content.match(queryContextReg) || []).slice(0, 5)
          .map(k => {
            let parts = queryContextReg.exec(k)
            if (!parts || parts.length < 4) { return }
            let [left, keyword, right] = parts.slice(1)
            return { left, keyword, right }
          }).filter(k => k)
        row.content = undefined
        row.appears = appears
      })
    }
    return result
  }
}
