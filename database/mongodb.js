const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');
const config = require('./mongodb-secret.json')

const user = encodeURIComponent(config.user);
const password = encodeURIComponent(config.pwd);
const authMechanism = 'DEFAULT';

// Connection URL
const url = `mongodb://${user}:${password}@${config.host}:${config.port}/?authMechanism=${authMechanism}`
let mongodb = null
// Use connect method to connect to the Server
MongoClient.connect(url, function (err, client) {
  assert.equal(null, err);
  console.log("数据库连接建立成功");
  mongodb = client.db("webservice")
});

module.exports = { mongodb }