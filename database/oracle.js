const oracledb = require('oracledb')
const dbSecret = require('./oracle-secret.js')

let connectionPool = null

module.exports = {
  async getConnection() {
    if(!connectionPool){
      connectionPool = await oracledb.createPool({ 
        ...dbSecret
      })
    }
    return await connectionPool.getConnection()
  }
}