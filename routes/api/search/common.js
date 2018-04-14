const log = require('fs').createWriteStream('search.log', { flags: 'w' })
const sleep = async (t) => new Promise(r => setTimeout(r, t))
const counter = require('../../../middleware/counter')
const db = require('../../../database/search')
const jieba = require('nodejieba')

function standardize (url) {
  return url.replace(/^.*:\/+/, '').replace(/\/(\?|$)/g, '$1').toLowerCase()
}

async function has(url) {
  let standardUrl = standardize(url)
  if (await db.page.find({ standardUrl }, 1)) {
    return true
  }
  if (await db.queue.find({ standardUrl }, 1)) {
    return true
  }
  return false
}

async function enqueue(url) {
  let standardUrl = standardize(url)
  await db.queue.insert({ standardUrl, url })
}

async function dequeue() {
  let row = await db.queue.find({}, 1)
  if (!row) return null
  let { standardUrl, url } = row
  await db.queue.remove({ standardUrl })
  return url
}

function cut (...args) {
  return jieba.tag(args.join('/').replace(/\s+/g, '')).map(k => k.word)
}

async function push (title, content, url) {
  title = title.trim()
  content = content.trim()
  let standardUrl = standardize(url)
  let updateTime = new Date().getTime()
  await db.page.remove({ standardUrl })
  await db.page.insert({ standardUrl, url, title, content, updateTime })
  for (let word of cut(title, content)) {
    await db.word.insert({ word, standardUrl })
  }
}

async function search (query, page, pagesize = 10) {
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

function filter (href) {
  try {
    let domain = /:\/\/([^\/]+)/.exec(href)[1]
    let protocol = /^([a-zA-Z]+):/.exec(href)[1]
    return ['http', 'https', 'ftp'].find(k => k === protocol)
      && (/^58\.192\.\d+\.\d+$/.test(domain) || /^223\.3\.\d+\.\d+$/.test(domain)
        || /\.seu\.edu\.cn$/.test(domain) && !/^s?bbs\.seu\.edu\.cn$/.test(domain))
  } catch (e) {
    return false
  }
}

module.exports = {
  jieba, has, enqueue, dequeue, cut, push, search, filter, sleep, log
}