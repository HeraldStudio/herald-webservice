/**
  # 路由自解释中间件
  提供能快速让接口列举其他相关接口的API，以便使用者灵活在接口之间穿梭，无需接口文档。

  ## 暴露接口
  ctx.related (route: string, description: string | object) => void  解释其他接口

  ## 用法举例
  //- /api/index.js
  this.related('card', {
    get: '{ date?: yyyy-M-d, page? } 一卡通信息及消费流水，不带 date 为当日流水',
    put: '{ password, amount: float, eacc?=1 } 一卡通在线充值'
  })
  this.related('srtp', 'SRTP 学分及项目查询') // 默认解释为 get 方法

  结果将会被 return（返回格式中间件）解析，放在返回 JSON 格式的 related 字段中。
 */
module.exports = async (ctx, next) => {
  let curPath = ctx.path.replace(/\/(index)?$/, '') + '/'
  ctx._related = []
  ctx.related = (path, desc) => {
    let absPath = /^\//.test(path) ? path : curPath + path
    if (typeof desc === 'string') {
      desc = { get: desc }
    }
    if (typeof desc === 'object') {
      let description = { url: absPath }
      'post,get,put,delete'.split(',').map(k => description[k] = desc[k])
      ctx._related.push(description)
    }
  }
  try {
    await next()
  } finally {
    if (!ctx._related.length) {
      ctx._related = undefined
    }
  }
}
