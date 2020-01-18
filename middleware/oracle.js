const oracle = require('../database/oracle.js');

module.exports = async (ctx, next) => {
  ctx.db = await oracle.getConnection()
  await next()
  await ctx.db.close()
}