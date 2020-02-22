/**
 * Created by WolfTungsten on 2018/1/31.
 * 
 * Rebuild by ZZJ on 2020/2/7
 * 注意：axios 中间件依赖 spider 提供的底层借口，修改的时候请务必注意
 */

const ws = require('ws')
const { config } = require('../app')
const tough = require('tough-cookie')
const uuid = require('uuid/v4')
const crypto = require('crypto')
// const sms = require('../sdk/yunpian')
const spiderCommonConfig = (() => {
  try {
    return require('./spider-secret.json')
  } catch (e) {
    return {}
  }
})()

// 用于爬虫的加密认证
const encryptSipder = (value) => {
  try {
    let cipheriv = crypto.createCipheriv(spiderCommonConfig.cipher, spiderCommonConfig.key, spiderCommonConfig.iv)
    let result = cipheriv.update(value, 'utf8', 'hex')
    result += cipheriv.final('hex')
    return result
  } catch (e) {
    // console.log(e)
    return ''
  }
}


// errcode定义
const NO_SPIDER_ERROR = 0              // 没有可用在线爬虫
const WEBSOCKET_TRASFER_ERROR = 1      // WS传输错误
const SERVER_ERROR = 2                 // 爬虫服务器错误
const REQUEST_ERROR = 3                // 远端请求错误

// const adminPhoneNumber = ['15651975186'] // 日后和鉴权平台融合

class SpiderServer {

  constructor() {
    
    this.connectionPool = {}   // 连接池
    this.requestPool = {}      // 请求池
    this.socketServer = new ws.Server({port: program.port + 1000})
  
    this.socketServer.on('connection', (connection) => {
      // console.log('connection')
      this.handleConnection(connection)
    })
    this.socketServer.on('error', (error) => {
      error.errCode = SERVER_ERROR
      // console.log(error)
    })
    console.log(chalkColored.green('[+] 分布式硬件爬虫服务正在启动...'))
  }

  handleConnection(connection) {
    let name = this.generateSpiderName()     // 爬虫名称
    connection.spiderName = name
    this.connectionPool[name] = connection
    connection.active = false
    let token = this.generateToken()         // 爬虫token
    connection.token = token
    
    console.log(`[I] 硬件爬虫 ${chalkColored.blue(`<${name}>`)} 连接建立，配对中.....`)
   
    let message = {
      spiderName: name,
      secret: encryptSipder(token)
    }
    
    // token 加密后发送给硬件爬虫
    connection.send(JSON.stringify(message))

    // 来自硬件爬虫数据的处理
    connection.on('message', async data => {
      // 有数据返回时即更新心跳时间戳
      connection.finalHeartBeat = +moment()
      // 如果是心跳包则拦截
      if (data === '@herald—spider') {
        connection.send('@herald-server') // 双向心跳包
        return
      }
      if (connection.active) {
        this.handleResponse(data)
      } else {
        // 爬虫认证
        try{
          if(connection.spiderName === JSON.parse(data).spiderName && connection.token === JSON.parse(data).token){
            this.acceptSpider(connection)
          }else{
            this.rejectSpider(connection)
          }
        }catch(e){
          this.rejectSpider(connection)
        }
      }
    })

    // 硬件爬虫关闭响应
    connection.on('close', () => {
      console.log(`[I] 硬件爬虫 <${connection.spiderName}> 连接关闭`)
      delete this.connectionPool[connection.spiderName]
    })
    
    // 硬件爬虫错误相应
    connection.on('error', (error) => {

      console.log(chalkColored.red(`[W]硬件爬虫 <${connection.spiderName}> 连接出错, 错误信息：`))
      console.log(error.message)

      delete this.connectionPool[connection.spiderName]
    })
  }

  // 接受硬件爬虫，也就是认证成功
  acceptSpider(connection) {
    connection.active = true
    console.log(`[I] 硬件爬虫 ${chalkColored.blue(`<${connection.spiderName}>`)} ${chalkColored.green('认证成功')}`)
    connection.send('Auth_Success')
  }

  // 拒绝硬件爬虫，也就是认证失败
  rejectSpider(connection) {
    console.log(`[W] 硬件爬虫 <${connection.spiderName}> ${chalkColored.red('认证失败')}`)
    delete this.connectionPool[connection.spiderName]
    connection.send('Auth_Fail')
    connection.terminate()
  }

  // 生成爬虫名称
  generateSpiderName() {
    let name
    do {
      name = Math.random().toString(36).substr(2)
      console.log(name)
    } while (this.connectionPool[name])
    return name
  }

  // 生成爬虫认证 token
  generateToken() {
    return uuid()
  }

  // 生成请求名称
  generateRequestName() {
    let name
    do {
      name = Math.random().toString(36).substr(2)
    } while (this.requestPool[name])
    return name
  }

  // request 请求编码，按照axios的格式编码
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

  // 私有的 request 方法
  _request(ctx, request) {
    let name = this.generateRequestName()
    request.requestName = name
    this.requestPool[name] = {name, ctx}
    // 按照axios格式处理请求
    if (request.transformRequest) {
      request.data = request.transformRequest(request.data, request.headers)
    }
    if (request.transformResponse) {
      this.requestPool[name].transformResponse = request.transformResponse
    }
    if (request.paramsSerializer) {
      request.params = request.paramsSerializer(request.params)
    }
    let encodedRequest = this.requestEncoder(request)

    return new Promise((resolve, reject) => {
      this.requestPool[name].resolve = resolve
      this.requestPool[name].reject = reject
      if (!request.timeout) {
        request.timeout = 7000
      }
      this.requestPool[name].timeout = setTimeout(() => {
        this.requestPool[name].isTimeout = true
        reject('timeout')
        delete this.requestPool[name]
      }, request.timeout)
      try {
        let spider = this.pickSpider()
        spider.send(encodedRequest)
      } catch (e) {
        // console.log('[-] 向硬件爬虫发送请求数据期间出错：' + e.message)
        e.errCode = WEBSOCKET_TRASFER_ERROR
        reject(e)
        clearTimeout(this.requestPool[name].timeout)
        delete this.requestPool[name]
      }
    })
  }

  // 对外暴露的 request 的方法
  async request(ctx, method, arg, config, transformRequest, transformResponse) {
    
    // axios 中间传来的两个处理函数
    // transformRequest 请求格式处理函数
    // transformResponse 响应格式处理函数
    let request = {transformRequest, transformResponse}

    request.cookie = ctx.cookieJar.toJSON()
    // console.log('request.cookie:',request.cookie)
    request.method = method.toLowerCase()
    request = this.merge(config, request)
    
    // 根据请求方法处理参数
    if (method === 'get' || method === 'delete') {
      // get\delete方法对应处理
      if (arg.length === 1) {
        // (url)
        request.url = arg[0]
      } else if (arg.length === 2) {
        // (url, config)
        request = this.merge(request, arg[1], {url: arg[0]})
      }
    } else {
      // post\put\方法处理
      if (arg.length === 1) {
        // (url)
        request.url = arg[0]
      } else if (arg.length === 2) {
        // (url, data)
        request = this.merge(request, {url: arg[0], data: arg[1]})
      } else if (arg.length === 3) {
        // (url, data, config)
        request = this.merge(request, arg[2], {url: arg[0], data: arg[1]})
      }
    }

    // 强制本地执行
    if (request.forceLocal) {
      console.log('[+] 该请求强制本地执行')
      throw new Error('force_local')
    }

    // console.log('request:',request)
    return this._request(ctx, request) // 传入ctx以满足cookieJar自动添加和实现
  }

  // 获取可以用的硬件爬虫列表
  getAvailableSpiders() {
    let timestamp = +moment()
    let availableList = []
    for (let name in this.connectionPool) {
      let heartCycle = timestamp - this.connectionPool[name].finalHeartBeat
      if (this.connectionPool[name].active && heartCycle <= config.spider.heartCycle) {
        availableList.push(this.connectionPool[name])
      }
    }
    return availableList
  }

  // 选一个可用的硬件爬虫
  pickSpider() {
    let availableList = this.getAvailableSpiders()
    let length = availableList.length
    if (length === 0) {
      throw {errCode: NO_SPIDER_ERROR, message: '没有可用爬虫'}
    }
    let r = Math.floor(Math.random() * length)
    return availableList[r]
  }

  handleResponse(data) {
    try {
      data = JSON.parse(data)
    } catch (e) {
      console.log(e.message)
      console.log(data)
      throw e
    }
    let requestName = data.requestName
    let requestObj = this.requestPool[requestName]
    if (!requestObj) {
      return
    }
    if (requestObj.isTimeout) {
      return
    }
    if (data.succ) {
      clearTimeout(requestObj.timeout)
      // 将data域解码为原始状态
      // 相应结果是 buffer
      data.data = requestObj.transformResponse(Buffer.from(data.data.data))
      // 自动更新cookieJar
      requestObj.ctx.cookieJar = tough.CookieJar.fromJSON(data.cookie)
      requestObj.resolve(data)
      delete this.requestPool[requestName]
    } else {
      clearTimeout(requestObj.timeout)
      data.errCode = REQUEST_ERROR
      if (data.data) {
        data.data = Buffer.from(data.data.data).toString()
      }
      requestObj.reject(data)
      delete this.requestPool[requestName]
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
        result[key] = this.merge(result[key], val)
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

// 留给统计接口的三个 API：查询当前爬虫，接受爬虫，拒绝爬虫
Object.defineProperty(module.exports, 'spiders', {
  get () {
    let pool = spiderServer.connectionPool
    let connections = Object.keys(pool).map(k => [k, pool[k]])
    let inactiveList = connections.filter(k => !k[1].active).map(k => k[0])
    let inactiveCount = inactiveList.length
    let activeCount = spiderServer.getAvailableSpiders().length
    let activeList = spiderServer.getAvailableSpiders().map(k => k.spiderName)
    return {
      activeCount, activeList, inactiveCount, inactiveList
    }
  }
})

module.exports.acceptSpider = (name) => {
  spiderServer.acceptSpider(spiderServer.connectionPool[name])
}

module.exports.rejectSpider = (name) => {
  spiderServer.rejectSpider(spiderServer.connectionPool[name])
}
