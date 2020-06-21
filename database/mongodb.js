const MongoClient = require('mongodb').MongoClient
const config = require('./mongodb-secret.json')

const user = encodeURIComponent(config.user)
const password = encodeURIComponent(config.pwd)
// const authMechanism = 'DEFAULT'

// Connection URL
const url = `mongodb://${user}:${password}@${config.dbs['0'].host}:${config.dbs['0'].port},${config.dbs['1'].host}:${config.dbs['1'].port},${config.dbs['2'].host}:${config.dbs['2'].port}/?authSource=admin&replicaSet=${config.replicaSetName}`
// 本地调试的时候自己取消注释吧
// const urlDebug = `mongodb://${config.host}:${config.port}/webservice`
const urlDebug = ''

let mongodb = null
let mongodbUrl = ''

const getCollection = async (col) => {
  if (mongodb) {
    return mongodb.collection(col)
  } else {
    //方便本地调试
    mongodbUrl = !(user && password) ? urlDebug : url

    mongodb = await MongoClient.connect(mongodbUrl, { useNewUrlParser: true, useUnifiedTopology: true })
    mongodb = mongodb.db('webservice')
    return mongodb.collection(col)
  }
}
module.exports = getCollection