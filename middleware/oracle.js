const oracle = require('../database/oracle.js')

module.exports = async (ctx, next) => {
  ctx.db = await oracle.getConnection()
  try { 
    await next()
  } finally {
    await ctx.db.close()
  }
}