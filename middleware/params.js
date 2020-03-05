/**
  # 参数解析中间件

  将 GET/DELETE 的 query 与 POST/PUT 的 body 合并成 ctx.params API。
  这里使用更严格的 HTTP 规范，GET/DELETE 不读 body，POST/PUT 不读 URL query。

  ## 依赖接口

  ctx.request.body    from koa-bodyparser

  ## 暴露接口

  ctx.params          object
 */
const bodyparser = require('koa-bodyparser')({
  enableTypes: ['json', 'form', 'text']
})

// const body = require('koa-body')({
//   multipart:true, // 支持文件上传
//   textLimit:'1mb',
//   formidable:{
//     keepExtensions: true,    // 保持文件的后缀
//     maxFieldsSize:2 * 1024 * 1024, // 文件上传大小
//   },
//   parsedMethods:['POST','GET','PUT','DELETE']
// })

module.exports = async (ctx, next) => {
  await bodyparser(ctx, async () => {
    if (/^get|delete$/i.test(ctx.method)) {
      ctx.params = ctx.query
    } else {
      ctx.params = ctx.request.body
    }
  }).catch(e => {
    ctx.params = e.body
  })
  await next()
}
