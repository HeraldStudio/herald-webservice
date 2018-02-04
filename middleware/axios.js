/**
  # 网络请求中间件

  允许模块代码直接进行网络请求。

  ## 暴露接口

  ctx.get         (string, object?) => Promise<AxiosResponse>
  ctx.post        (string, stringOrObject?, object?) => Promise<AxiosResponse>
  ctx.put         (string, stringOrObject?, object?) => Promise<AxiosResponse>
  ctx.delete      (string, object?) => Promise<AxiosResponse>
  ctx.cookieJar   tough.CookieJar

  例：
  - `let res = (await this.get/post/put/delete('http://google.com')).data`
 */
const axios = require('axios')
const { Semaphore } = require('await-semaphore')
const config = require('../config.json')
const sem = new Semaphore(10)
const axiosCookieJarSupport = require('axios-cookiejar-support').default
const tough = require('tough-cookie')
axiosCookieJarSupport(axios)

/**
  ## 安全性

  由于学校部分 HTTPS 的上游服务器可能存在证书问题，这里需要关闭 SSL 安全验证。
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

module.exports = async (ctx, next) => {

/**
  ## 饼干罐 🍪 Cookie Jar

  对于每一个 Context，将自动生成一个饼干罐 (Cookie Jar) 用于存储饼干 (Cookies)。
  在 auth 中间件中，若用户已登录，将向饼干罐中放入用户的初始饼干；以后的每次 axios 请求，会自动
  携带饼干罐进行，并保存请求得到的新饼干。(Trick or Treat!)
 */
  ctx.cookieJar = new tough.CookieJar()

/**
  ## 实现

  利用 10 线程的伪线程池 semaphore 进行网络请求，支持 get/post/put/delete 四个方法
 */
  let _axios = axios.create({
    validateStatus: () => true,
    withCredentials: true,
    jar: ctx.cookieJar,
    ...config.axios
  })

  ;['get','post','put','delete'].forEach(k => {
    ctx[k] = async function () {
      let release = await sem.acquire()
      let result = await _axios[k].apply(undefined, arguments)
      release()
      return result
    }
  })
  await next()
}
