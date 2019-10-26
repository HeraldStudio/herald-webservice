const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');
const config = require('./mongodb-secret.json')

const user = encodeURIComponent(config.user);
const password = encodeURIComponent(config.pwd);
const authMechanism = 'DEFAULT';

// Connection URL
const url = `mongodb://${user}:${password}@${config.host}:${config.port}/webservice?authMechanism=${authMechanism}`
let mongodb = null

const getCollection = async(col) => {
  if (mongodb) {
    return mongodb.collection(col)
  } else {
    mongodb = await MongoClient.connect(url, { useNewUrlParser: true, useUnifiedTopology: true })
    mongodb = mongodb.db("webservice")
    return mongodb.collection(col)
  }
}
module.exports = getCollection