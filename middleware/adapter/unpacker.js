module.exports = async (ctx, next) => {
  await next()
  if (ctx.path.indexOf('/adapter-') === 0) {
    ctx.body = ctx.body.result || ctx.body.reason || 'OK'
  }
}
