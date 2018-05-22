/**
 * Created by WolfTungsten on 2018/1/31.
 */

const ws = require('ws')
const net = require('net')
const { config } = require('../app')
const chardet = require('chardet')
const axios = require('axios')
const tough = require('tough-cookie')
const chalk = require('chalk')
const sms = require('../sdk/yunpian')
const slackMessage = require('./slack').SlackMessage
const spiderSecret = (() => {
  try {
    return require('./spider-secret.json')
  } catch (e) {
    return {}
  }
})()

// errcode定义
const NO_SPIDER_ERROR = 0 // 没有可用在线爬虫
const WEBSOCKET_TRASFER_ERROR = 1 // WS传输错误
const SERVER_ERROR = 2 // 爬虫服务器错误
const REQUEST_ERROR = 3 // 远端请求错误

const adminPhoneNumber = ['15651975186'] // 日后和鉴权平台融合
class SpiderServer {

  constructor() {
    let that = this
    this.connectionPool = {}  // 连接池
    this.requestPool = {}  // 请求池
    this.socketServer = new ws.Server({port: config.spider.port})
    this.socketServer.on('connection', (connection) => {
      this.handleConnection(connection)
    })
    this.socketServer.on('error', (error) => {
      error.errCode = SERVER_ERROR;
      console.log(error)
    })
    console.log(chalk.green('[+] 分布式硬件爬虫服务正在运行...'))
  }

  handleConnection(connection) {
    let name = this.generateSpiderName()
    connection.spiderName = name
    this.connectionPool[name] = connection
    connection.active = false
    let token = this.generateToken()
    console.log(`[I] 硬件爬虫 ${chalk.blue(`<${name}>`)} 连接建立，请使用口令 ${chalk.blue(`<${token}>`)} 完成配对`)
    sms.spiderToken(adminPhoneNumber, name, token)

    // 使用 slack 认证的部分
    // new slackMessage().send(`分布式硬件爬虫 ${name} 请求连接认证，请核实是否内部人员操作`, [
    //     {
    //       name: 'accept',
    //       text: '接受',
    //       style: 'primary',
    //       response: `👌分布式硬件爬虫 ${name} 已连接`,
    //       confirm: {
    //         title: "⚠️警告",
    //         text: "连接的爬虫会截获webservice3发起请求包含的所有数据，请务必确认该操作由内部人员操作以保证信息安全！",
    //         ok_text: "确认连接",
    //         dismiss_text: "容我思考下"
    //       }
    //     }, {
    //       name: 'refuse',
    //       text: '拒绝',
    //       response: `❌已拒绝分布式硬件爬虫 ${name} 连接`
    //     }
    //   ]).then((tag) => {
    //     try {
    //       if (tag === 'accept') {
    //         this.acceptSpider(connection)
    //       } else {
    //         this.rejectSpider(connection)
    //       }
    //     } catch (e) {}
    //   })

    connection.token = token
    let message = {spiderName: name}
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
        // token 认证的部分
        let { token } = JSON.parse(data)

        // 老版密令主动认证
        if (token in spiderSecret) {
          this.acceptSpider(connection)
          console.log(`爬虫 ${connection.spiderName} 主动认证成功`)
          // new slackMessage().send(`爬虫 ${connection.spiderName} 主动认证成功，身份标识 ${spiderSecret[token]}`)
        }
        
        // 新版运维登录 token 认证
        else try {
          let res = await axios.get(`http://localhost:${config.port}/api/admin/admin`, {
            headers: { token }
          })
          if (res.data.result.maintenance) {
            let name = res.data.result.maintenance.name
            this.acceptSpider(connection)
            console.log(`爬虫 ${connection.spiderName} 运维认证成功，操作者${name}`)
            // new slackMessage().send(`爬虫 ${connection.spiderName} 运维认证成功，操作者${name}`)
          } else {
            this.rejectSpider(connection)
          }
        } catch (e) {
          this.rejectSpider(connection)
        }
      }
    })

    // 硬件爬虫关闭响应
    connection.on("close", (code, reason) => {
      // console.log(`[I]硬件爬虫 <${connection.spiderName}> 连接关闭,code=${code}, reason=${reason}`)
      delete this.connectionPool[connection.spiderName]
    })

    connection.on("error", (error) => {

      console.log(chalk.red(`[W]硬件爬虫 <${connection.spiderName}> 连接出错, 错误信息：`))
      console.log(error.message)

      delete this.connectionPool[connection.spiderName]
    })
  }

  acceptSpider(connection) {
    connection.active = true
    console.log(`[I] 硬件爬虫 <${connection.spiderName}> ${chalk.green('认证成功')}`)
    connection.send('Auth_Success')
  }

  rejectSpider(connection) {
    console.log(`[W] 硬件爬虫 <${connection.spiderName}> ${chalk.red('认证失败')}`)
    delete this.connectionPool[connection.spiderName]
    connection.send('Auth_Fail')
    connection.terminate()
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
    request.requestName = name
    this.requestPool[name] = {name, ctx}
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
    if (request.forceLocal) {
      console.log('[+] 该请求强制本地执行')
      throw new Error('force_local')
    }
    return this._request(ctx, request) // 传入ctx以满足cookieJar自动添加和实现
  }

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
      data = JSON.parse(data);
    } catch (e) {
      console.log(e.message);
      console.log(data);
      throw e;
    }
    let requestName = data.requestName;
    let requestObj = this.requestPool[requestName];
    if (!requestObj) {
      return
    }
    if (requestObj.isTimeout) {
      return
    }
    if (data.succ) {
      clearTimeout(requestObj.timeout)
      // 将data域解码为原始状态
      data.data = requestObj.transformResponse(Buffer.from(data.data.data))
      try {
        data.data = JSON.parse(data.data)
      } catch (e) {
      }
      // 自动更新cookieJar
      requestObj.ctx.cookieJar = tough.CookieJar.fromJSON(data.cookie)
      requestObj.resolve(data)
      delete this.requestPool[requestName]
    } else {
      clearTimeout(requestObj.timeout)
      data.errCode = REQUEST_ERROR
      if (data.hasOwnProperty('data')) {
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

// 留给统计接口的三个 API：查询当前爬虫，接受爬虫，拒绝爬虫
Object.defineProperty(module.exports, 'spiders', {
  get () {
    let pool = spiderServer.connectionPool
    let connections = Object.keys(pool).map(k => [k, pool[k]])
    let inactiveList = connections.filter(k => !k[1].active).map(k => k[0])
    let inactiveCount = inactiveList.length
    let activeCount = spiderServer.getAvailableSpiders().length
    return {
      activeCount, inactiveCount, inactiveList
    }
  }
})

module.exports.acceptSpider = (name) => {
  spiderServer.acceptSpider(spiderServer.connectionPool[name])
}

module.exports.rejectSpider = (name) => {
  spiderServer.rejectSpider(spiderServer.connectionPool[name])
}
