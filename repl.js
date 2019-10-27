const vm = require('vm')
const qs = require('querystring')
const repl = require('repl')
const axios = require('axios')
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
    baseURL: `http://localhost:${config.port}/`,
    validateStatus: () => true
  })

  console.log('')
  console.log(`命令格式：${chalkColored.green('[get]/post/put/delete')} 路由 ${chalkColored.cyan('[参数1=值1...]')}`)
  console.log(`命令示例：${chalkColored.green('put')} api/card ${chalkColored.cyan('amount=0.2 password=123456')}`)
  console.log('')
  console.log(`1. auth 请求省略形式：${chalkColored.blue('auth 一卡通号 密码 [研院密码]')}；使用 ${chalkColored.blue('delete auth')} 退出登录。`)
  console.log(`   成功后 token 将保存，后续请求都会自动带上，使用 ${chalkColored.blue('auth [token]')} 可直接切换 token；`)
  console.log(`   ${chalkColored.magenta('对于研究生，不提供研究生院密码时默认与统一身份认证密码相同，若无效将抛出 401；')}`)
  console.log('2. 需要传复杂参数直接用 js 格式书写即可，支持 JSON 兼容的任何类型：')
  console.log(`   ${chalkColored.green('put')} api/card ${chalkColored.cyan('{ amount: 0.2, password: 123456 }')}`)
  console.log(`3. 连接远程 WS3 服务器：${chalkColored.green('server')} https://myseu.cn/ws3/`)

  let replServer = repl.start({
    prompt: '\n> ',
    eval: (cmd, context, filename, callback) => {
      let parts = /^(?:(get|post|put|delete)\s+)?(\S+)(?:\s+([\s\S]+))?$/im.exec(cmd.trim())
      if (!parts) {
        return callback(null)
      }

      let [method, path, params] = parts.slice(1)

      let composedParams = {}

      if (params) {
        if (/^(\S+=\S+)(\s+(\S+=\S+))*$/m.test(params)) {
          params.split(/\s+/g).map(param => {
            let [key, value] = param.split('=')
            composedParams[key] = value
          })
        } else if (/^server$/.test(path) && !method) {
          testClient.defaults.baseURL = params
          console.log(`\n基地址改为 ${params} 了！`)
          return callback(null)
        } else if (/^auth$/.test(path) && !method) {
          method = 'post'
          let [cardnum, password, gpassword] = params.split(/\s+/g)

          if (password) {
            composedParams = { cardnum, password, gpassword, platform: 'repl' }
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

      if (!method) {
        method = 'get'
      } else {
        method = method.toLowerCase()
      }

      if (Object.keys(composedParams).length && (method === 'get' || method === 'delete')) {
        path += '?' + qs.stringify(composedParams)
        composedParams = {}
      }

      testClient[method](path, composedParams).then(res => {
        if (/^\/?auth$/.test(path) && res.data.result) {
          if (method === 'post') {
            console.log(`\n用 ${composedParams.cardnum} 的身份登录了！`)
            testClient.defaults.headers = { token: res.data.result }
          } else if (method === 'delete') {
            console.log('\n退出登录了！')
            testClient.defaults.headers = {}
          }
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

  require('repl.history')(replServer, './.repl_history')
}
