module.exports = async (ctx, next) => {
  await next()
  if (ctx.path.indexOf('/adapter-') === 0) {
    if (ctx.body.code >= 400) {
      ctx.body = ''
      ctx.throw(ctx.body.code)
    } else {
      ctx.body = ctx.body.result
    }
  }
}
