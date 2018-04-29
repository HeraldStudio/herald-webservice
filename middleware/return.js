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
    ctx.body = ''
    if (!e) {
      ctx.status = 400
    } else if (typeof e === 'number') {
      ctx.status = e
    } else if (typeof e === 'string') {
      ctx.body = e
      ctx.status = 400
    } else if (e.message
      && /^Request failed with status code (\d+)$/.test(e.message)) { // 探测 Axios 异常
      ctx.status = 503
    } else if (e.message
      && /^timeout of \d+ms exceeded$/.test(e.message)) { // 探测 Axios 异常
      ctx.status = 408
    } else {
      console.trace(e)
      ctx.status = 400
    }
  }

  let json = {}

  if (ctx.response.get('Location')) {
    ctx.status = 302
    return
  } else if (ctx.status < 400) {
    json = {
      success: true,
      code: ctx.status || 200,
      result: ctx.body,
      related: ctx._related
    }
  } else {
    json = {
      success: false,
      code: ctx.status || 200,
      reason: ctx.body,
      related: ctx._related
    }
    if (!ctx.body) {
      if (ctx.status === 400) {
        json.reason = '请求出错'
      } else if (ctx.status === 401) {
        json.reason =
          ctx.request.path === '/auth' ?
            '登录失败' : (ctx.request.headers.token ? '登录失败或已过期' : '需要登录')
      } else if (ctx.status === 403) {
        json.reason = '权限不允许'
      } else if (ctx.status === 404) {
        json.reason = '内容不存在'
      } else if (ctx.status === 405) {
        json.reason = '调用方式不正确'
      } else if (ctx.status === 408) {
        json.reason = '与学校相关服务通信超时'
      } else if (ctx.status === 500) {
        json.reason = '服务器出错'
      } else if (ctx.status === 502) {
        json.reason = '服务器维护'
      } else if (ctx.status === 503) {
        json.reason = '学校相关服务出现故障'
      } else {
        json.code = 400
        json.reason = '未知错误'
      }
    }
  }

  ctx.body = json
  ctx.status = 200
}
