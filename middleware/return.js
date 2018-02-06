/**
  # 返回格式中间件

  按照一定的规则，规范返回格式，将 HTTP Status Code 下放到 JSON 中，使 HTTP Status Code 保持为 200。
 */

module.exports = async (ctx, next) => {

  // 不要使用这个对流程控制具有迷惑性的 API，请直接用 throw 代替
  ctx.throw = (code) => { throw code }

  try {
    await next()
  } catch (e) {
    console.log(e)
    console.log(ctx.status)
    if (typeof e === 'number') {
      ctx.status = e
    } else if (typeof e === 'string') {
      ctx.status = 400
      ctx.body = e
    } else if (/^Request failed with status code (\d+)$/.test(e.message)) { // 探测 Axios 异常
      let axiosCode = parseInt(RegExp.$1)
      if (axiosCode === 401) {
        ctx.status = axiosCode
      } else {
        ctx.status = 503
      }
    } else if (/^timeout of \d+ms exceeded$/.test(e.message)) { // 探测 Axios 异常
      ctx.status = 408
    } else {
      console.error(e)
      ctx.status = 400
    }
  }

  if (!ctx.body) {
    if (ctx.status === 400) {
      ctx.body = '请求出错'
    } else if (ctx.status === 401) {
      ctx.body = ctx.request.headers.token ? '登录失败或已过期' : '需要登录'
    } else if (ctx.status === 403) {
      ctx.body = '权限不允许'
    } else if (ctx.status === 404) {
      ctx.body = '接口不存在'
    } else if (ctx.status === 405) {
      ctx.body = '调用方式不正确'
    } else if (ctx.status === 408) {
      ctx.body = '与学校相关服务通信超时'
    } else if (ctx.status === 500) {
      ctx.body = '服务器出错'
    } else if (ctx.status === 502) {
      ctx.body = '服务器维护'
    } else if (ctx.status === 503) {
      ctx.body = '学校相关服务出现故障'
    } else {
      console.error(e)
      ctx.status = 400
      ctx.body = '未知错误'
    }
  }

  ctx.body = ctx.status < 400 ? {
    success: true,
    code: ctx.status,
    result: ctx.body
  } : {
    success: false,
    code: ctx.status,
    reason: ctx.body
  }

  ctx.status = 200
}
