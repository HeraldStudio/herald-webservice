/**
 * Created by WolfTungsten on 2018/1/31.
 */

const ws = require('ws')
const net = require('net')
const config = require('../config.json')
const chardet = require('chardet')
const axios = require('axios');
const tough = require('tough-cookie')
const chalk = require('chalk')

// errcode定义
const NO_SPIDER_ERROR = 0 // 没有可用在线爬虫
const WEBSOCKET_TRASFER_ERROR = 1 // WS传输错误
const SERVER_ERROR = 2 // 爬虫服务器错误
const REQUEST_ERROR = 3 // 远端请求错误

const dev = !(process.env.NODE_ENV === 'production') // 非生产环境
const adminPhoneNumber = ['15651975186'] // 日后和鉴权平台融合
class SpiderServer {

  constructor() {
    let that = this
    this.connectionPool = {}  // 连接池
    this.requestPool = {}  // 请求池
    this.socketServer = new ws.Server({port:config.spider.port})
    this.socketServer.on('connection', (connection) => {
      this.handleConnection(connection)
    })
    this.socketServer.on('error', (error)=>{error.errCode = SERVER_ERROR; console.log(error)})
    console.log(chalk.green('[+] 分布式硬件爬虫服务正在运行...'))

  }

  handleConnection(connection) {
    let name = this.generateSpiderName()
    connection.spiderName = name
    this.connectionPool[name] = connection
    connection.active = false
    let token = this.generateToken()
    if (dev) {
      // 测试环境token在控制台输出
      // 生产环境token只发送到管理员手机
      console.log(`[I]硬件爬虫 ${chalk.blue(`<${name}>`)} 连接建立，请使用口令 ${chalk.blue(`<${token}>`)} 完成配对`)
    }
    connection.token = token
    let message = {spiderName:name}
    connection.send(JSON.stringify(message))

    // 来自硬件爬虫数据的处理
    connection.on('message', (data) => {
      if (connection.active) {
        this.handleResponse(data)
      } else {
        let token = JSON.parse(data).token
        if (token === connection.token) {
          // 验证成功
          connection.active = true
          console.log(`[I]硬件爬虫 <${connection.spiderName}> ${chalk.green('认证成功')}`)
          connection.send('Auth_Success')
        } else {
          //验证失败，关闭连接
          console.log(`[W]硬件爬虫 <${connection.spiderName}> ${chalk.red('认证失败')}`)
          delete this.connectionPool[connection.spiderName]
          connection.send('Auth_Fail')
          connection.terminate()
        }
      }
    })

    // 硬件爬虫关闭响应
    connection.on("close",(code, reason) => {
      console.log(`[I]硬件爬虫 <${connection.spiderName}> 连接关闭,code=${code}, reason=${reason}`)
      delete this.connectionPool[connection.spiderName]
    })

    connection.on("error", (error) => {
      console.log(`[W]硬件爬虫 <${connection.spiderName}> 连接出错, 错误信息：`)
      console.log(error)
      delete this.connectionPool[connection.spiderName]
    })

  }

  generateSpiderName() {
    let name
    do {
      name = Math.random().toString(36).substr(2)
    } while (this.connectionPool.hasOwnProperty(name))
    return name
  }

  generateRequestName() {
    let name
    do {
      name = Math.random().toString(36).substr(2)
    } while (this.requestPool.hasOwnProperty(name))
    return name
  }

  generateToken() {
    let token = ''
    token += parseInt((Math.random() * 4 + 1).toString())
    token += parseInt((Math.random() * 4 + 1).toString())
    token += parseInt((Math.random() * 4 + 1).toString())
    token += parseInt((Math.random() * 4 + 1).toString())
    return token
  }

  requestEncoder(request) {
  // 对于 Axios 库标准请求对象进行编码
    let perEncode = {
      requestName: request.requestName,
      url: request.url,
      method: request.method,
      baseURL: request.baseURL,
      headers: request.headers,
      params: request.params,
      timeout: request.timeout,
      auth: request.auth,
      responseType: request.responseType,
      xsrfCookieName: request.xsrfCookieName,
      xsrfHeaderName: request.xsrfHeaderName,
      maxContentLength: request.maxContentLength,
      maxRedirects: request.maxRedirects,
      proxy: request.proxy,
      cookie: request.cookie
    }
    if (request.data) {
      perEncode.data = Buffer.from(request.data)
    }
    return JSON.stringify(perEncode)
    // 返回 String
  }

  _request(ctx, request) {
    let name = this.generateRequestName()
    request.requestName  = name
    this.requestPool[name] = { name , ctx }
    // 按照axios格式处理请求
    if (request.hasOwnProperty('transformRequest')) {
      request.data = request.transformRequest(request.data, request.headers)
    }
    if (request.hasOwnProperty('transformResponse')) {
      this.requestPool[name].transformResponse = request.transformResponse
    }
    if (request.hasOwnProperty('paramsSerializer')) {
      request.params = request.paramsSerializer(request.params)
    }
    let encodedRequest = this.requestEncoder(request)

    return new Promise((resolve, reject) => {
      this.requestPool[name].resolve = resolve
      this.requestPool[name].reject = reject
      try {
        let spider = this.pickSpider()
        spider.send(encodedRequest)
      } catch (e) {
        console.log('[-]向硬件爬虫发送请求数据期间出错，错误信息：')
        e.errCode = WEBSOCKET_TRASFER_ERROR
        reject(e)
      }
    })

  }

  async request(ctx, method, arg, config, transformRequest, transformResponse) {
    let request = {transformRequest, transformResponse}
    request.cookie = ctx.cookieJar.toJSON()
    request.method = method.toLowerCase()
    request = this.merge(config, request)
    if (method === 'get' || method === 'delete') {
      // get\delete方法对应处理
      if (arg.length === 1) {
        // (url)
        request.url = arg[0]
      } else if (arg.length === 2) {
        // (url, config)
        request = this.merge({url:arg[0]}, arg[1], request)
      }
    } else {
      // post\put\方法处理
      if (arg.length === 1) {
        // (url)
        request.url = arg[0]
      } else if (arg.length === 2) {
        // (url, data)
        request = this.merge({url:arg[0], data:arg[1]}, request)
      } else if (arg.length === 3) {
        // (url, data, config)
        request = this.merge({url:arg[0], data:arg[1]}, arg[2], request)
      }
    }
    if (request.forceLocal) {
      console.log('[+] 该请求强制本地执行')
      throw 'force_local'
    }
    return this._request(ctx, request) // 传入ctx以满足cookieJar自动添加和实现
  }

  pickSpider() {
    let avaliableList = []
    for (let name in this.connectionPool) {
      if (this.connectionPool[name].active) {
        avaliableList.push(this.connectionPool[name])
      }
    }
    let length = avaliableList.length
    if (length === 0) {
      throw {errCode:NO_SPIDER_ERROR, msg:'没有可用爬虫'}
    }
    let r = Math.floor(Math.random() * length)
    return avaliableList[r]
  }

  handleResponse(data) {
    data = JSON.parse(data)
    let requestName = data.requestName
    let requestObj = this.requestPool[requestName]
    if (data.succ) {
      // 将data域解码为原始状态
      data.data = Buffer.from(data.data.data).toString()
      try { data.data = JSON.parse(data.data) } catch (e) {}
      // 自动更新cookieJar
      requestObj.ctx.cookieJar = tough.CookieJar.fromJSON(data.cookie)
      requestObj.resolve(data)
    } else {
      data.errCode = REQUEST_ERROR
      if (data.hasOwnProperty('data')) {
        data.data = Buffer.from(data.data.data).toString()
      }
      requestObj.reject(data)
    }
  }

  // 用于参数处理
  merge() {
    function forEach(obj, fn) {
      if (obj === null || typeof obj === 'undefined') {
        return
      }

      if (typeof obj !== 'object') {
        obj = [obj]
      }

      if (isArray(obj)) {
        for (var i = 0, l = obj.length; i < l; i++) {
          fn.call(null, obj[i], i, obj)
        }
      } else {
        for (var key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
            fn.call(null, obj[key], key, obj)
          }
        }
      }
    }

    function isArray(val) {
      return toString.call(val) === '[object Array]'
    }

    let result = {}
    let assignValue = (val, key) => {
      if (typeof result[key] === 'object' && typeof val === 'object') {
        result[key] = merge(result[key], val)
      } else {
        result[key] = val
      }
    }

    [].slice.call(arguments).map(k => forEach(k, assignValue))

    return result
  }
}

const spiderServer = new SpiderServer()

module.exports = async (ctx, next) => {
  ctx.spiderServer = spiderServer
  await next()
}
