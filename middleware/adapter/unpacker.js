module.exports = async (ctx, next) => {
  await next()
  if (ctx.path.indexOf('/adapter-') === 0) {
    if (ctx.body.code >= 400) {
      ctx.body = ''
      ctx.throw(ctx.body.code)
    } else if (/Redirecting to <a href="(.*)">\1<\/a>\./.test(ctx.body.result)) {
      ctx.redirect(RegExp.$1)
    } else {
      ctx.body = ctx.body.result || 'OK'
    }
  }
}
