const db = require('sqlongo')('search')

db.page = {
  standardUrl: 'text primary key',
  url: 'text not null',
  title: 'text not null',
  content: 'text not null',
  updateTime: 'int not null'
}

db.queue = {
  standardUrl: 'text primary key',
  url: 'text not null'
}

db.word = {
  word: 'text not null',
  standardUrl: 'text not null'
}

module.exports = db
