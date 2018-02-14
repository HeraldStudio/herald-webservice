const vm = require('vm')
const qs = require('querystring')
const repl = require('repl')
const axios = require('axios')
const chalk = require('chalk')
const { config } = require('./app')
const prettyjson = require('prettyjson')

function isRecoverableError(error) {
  if (error.name === 'SyntaxError') {
    return /^(Unexpected end of input|Unexpected token)/.test(error.message)
  }
  return false
}

exports.start = () => {
  const testClient = axios.create({
    baseURL: `http://localhost:${config.port}/`
  })

  console.log('\n欢迎使用' + chalk.blue(' Herald WebService3 ') + '测试终端！')
  console.log('服务器已经开始运行，你可以直接在此终端中敲下命令进行测试请求')
  console.log('')
  console.log(`命令格式：${chalk.green('[get/post/put/delete]')} [路由] ${chalk.cyan('[参数1=值1...]')}`)
  console.log(`命令示例：${chalk.green('put')} api/card ${chalk.cyan('amount=0.2 password=123456')}`)
  console.log('')
  console.log(`1. auth 请求提供了特殊省略形式：${chalk.blue('auth [一卡通号] [密码] [平台名]')}`)
  console.log(`   成功后 token 将保存，后续测试请求都会自动带上，输入 deauth 可清除；`)
  console.log(`   使用 ${chalk.blue('auth [token]')} 可直接切换 token；`)
  console.log('2. 省略 get/post/put/delete 时，有参数默认为 post，否则为 get；')
  console.log('3. 需要传复杂参数直接用 js 格式书写即可，支持 JSON 兼容的任何类型：')
  console.log(`${chalk.green('put')} api/card ${chalk.cyan('{ amount: 0.2, password: 123456 }')}`)
  console.log(`4. 连接远程 WS3 服务器：${chalk.green('server')} https://boss.myseu.cn/ws3/`)
  console.log('')
  console.log('测试终端开始了！')

  let replServer = repl.start({
    prompt: '\n→ ',
    eval: (cmd, context, filename, callback) => {
      let parts = /^(?:(get|post|put|delete)\s+)?(\S+)(?:\s+([\s\S]+))?$/im.exec(cmd.trim())
      if (!parts) {
        return callback(null)
      }

      let [method, path, params] = parts.slice(1)

      if (path === 'deauth') {
        testClient.defaults.headers = {}
        console.log('\n清除用户身份了！')
        return callback(null)
      }

      if (!method) {
        method = params ? 'post' : 'get'
      } else {
        method = method.toLowerCase()
      }

      let composedParams = {}

      if (params) {
        if (/^(\S+=\S+)(\s+(\S+=\S+))*$/m.test(params)) {
          params.split(/\s+/g).map(param => {
            let [key, value] = param.split('=')
            composedParams[key] = value
          })
        } else if (/^server$/.test(path)) {
          testClient.defaults.baseURL = params
          console.log(`\n基地址改为 ${params} 了！`)
          return callback(null)
        } else if (/^auth$/.test(path)) {
          let [cardnum, password, platform] = params.split(/\s+/g)
          if (password) {
            composedParams = { cardnum, password, platform }
          } else if (params) {
            testClient.defaults.headers = { token: params }
            console.log(`\n用户身份改为 ${params} 了！`)
            return callback(null)
          }
        } else {
          try {
            composedParams = vm.runInThisContext('(' + params + ')')
          } catch (e) {
            if (isRecoverableError(e)) {
              return callback(new repl.Recoverable(e))
            } else {
              console.error(e.message)
              return callback(null)
            }
          }
        }
      }

      if (Object.keys(composedParams).length && (method === 'get' || method === 'delete')) {
        path += '?' + qs.stringify(composedParams)
        composedParams = {}
      }

      testClient[method](path, composedParams).then(res => {
        if (/^\/?auth$/.test(path) && res.data.result) {
          console.log(`\n用 ${composedParams.cardnum} 的身份登录了！`)
          testClient.defaults.headers = { token: res.data.result }
        }
        console.log('\n' + prettyjson.render(res.data))
        callback(null)
      })
    }
  })

  replServer.on('exit', () => {
    console.log('退出服务器了！')
    process.exit()
  })
}
