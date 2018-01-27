/**
 # 网络请求中间件
   允许模块代码直接进行网络请求

 - `let res = (await this.get/post/put/delete('http://google.com')).data`（普通请求）
 - `let res = (await this.get/post/put/delete('/curriculum')).data`（递归请求 WS3）
 */
const axios = require('axios')
const { Semaphore } = require('await-semaphore')
const config = require('../config.json')
const sem = new Semaphore(10)

// 关闭 HTTPS 网络请求的安全验证
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// 将 axios 的 get/post/put/delete 四个方法注入到 ctx 中
module.exports = async (ctx, next) => {

  // 若请求相对路径，则递归请求 WS3，便于模块之间依赖
  let _axios = axios.create({
      baseURL: `http://localhost:${config.port}/`,
      ...config.axios
    })

  // 所有网络请求在线程池中执行，不超过 10 个线程
  ;['get','post','put','delete'].forEach(k => {
    ctx[k] = async function () {
      let url = arguments[0]
      let relative = url.indexOf('//') === -1
      let result
      if (!relative) {
        let release = await sem.acquire()
        result = await _axios[k].apply(undefined, arguments)
        release()
      } else {
        arguments
      }
      if (result.code < 400) {
        return result.data
      } else {
        throw new Error('HTTP ' + result.code)
      }
    }
  })
  await next()
}
