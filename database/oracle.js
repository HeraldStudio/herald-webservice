const oracledb = require('oracledb')
const dbSecret = require('./oracle-secret.js')

oracledb.autoCommit = true
let connectionPool = null
let allinoneCardConnectionPool = null

module.exports = {
  async getConnection() {
    if(!connectionPool){
      connectionPool = await oracledb.createPool({ 
        ...dbSecret.herald
      })
    }
    return await connectionPool.getConnection()
  },
  async getAllinoneCardConnection() {
    if(!allinoneCardConnectionPool){
      allinoneCardConnectionPool = await oracledb.createPool({ 
        ...dbSecret.allinoneCard
      })
    }
    return await allinoneCardConnectionPool.getConnection()
  }
}