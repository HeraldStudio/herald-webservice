const db = require('../../database/search')
const cp = require('child_process')
const jieba = require('nodejieba')

RegExp.escape = (s) => s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')

function cut(...args) {
  return jieba.tag(args.join('/').replace(/\s+/g, '')).map(k => k.word)
}

if (process.env.NODE_ENV === 'production') {
  let worker = cp.spawn('node', [require.resolve('../../worker/search/spider')])
  process.on('exit', () => worker.kill())
}

async function search(query, page, pagesize = 10) {
  let words = cut(query)
  let cond = words.map(k => 'word.word = ?').join(' or ')
  let count = (await db.raw(`
    select count(distinct(standardUrl)) count from word ${cond ? 'where ' + cond : ''}
  `, words))[0].count

  if (pagesize <= 0) {
    return { count }
  }
  let rows = await db.raw(`
    select * from (
      select count(*) wordHitCount, standardUrl from word
      ${cond ? 'where ' + cond : ''}
      group by word.standardUrl
    ) words inner join page on words.standardUrl = page.standardUrl
    order by (case
      when title = ? then 1
      when title like ? then 2
      else 3
    end) * 100000 - wordHitCount limit ? offset ?
  `, words.concat([query, `%${query}%`, pagesize, (page - 1) * pagesize]))

  return { count, rows }
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
