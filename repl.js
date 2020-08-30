const vm = require('vm')
const qs = require('querystring')
const repl = require('repl')
const axios = require('axios')
const { config } = require('./app')
const prettyjson = require('prettyjson')
const oracle = require('./database/oracle')
const crypto = require('crypto')

const hash = value => {
  return Buffer.from(crypto.createHash('sha256').update(value).digest()).toString('hex')
}


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
  console.log(`1. auth 请求省略形式：${chalkColored.blue('auth 一卡通号')}；使用 ${chalkColored.blue('delete auth')} 退出登录。`)
  console.log(`   成功后 token 将保存，后续请求都会自动带上`)
  console.log('2. 需要传复杂参数直接用 js 格式书写即可，支持 JSON 兼容的任何类型：')
  console.log(`   ${chalkColored.green('put')} api/card ${chalkColored.cyan('{ amount: 0.2, password: 123456 }')}`)
  // console.log(`3. 连接远程 WS3 服务器：${chalkColored.green('server')} https://myseu.cn/ws3/`)

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
          oracle.getConnection().then(async (db) => {
            const cardnum = params
            let name, schoolnum = null
            if (cardnum.startsWith('21')) {
              // 本科生库
              const record = await db.execute(
                `SELECT XM, XJH FROM TOMMY.T_BZKS
        WHERE XH=:cardnum`, [cardnum]
              )
              if (record.rows.length > 0) {
                name = record.rows[0][0]
                schoolnum = record.rows[0][1]
              }
            } else if (cardnum.startsWith('22') || cardnum.startsWith('23')) {
              // 研究生库
              const record = await db.execute(
                `SELECT XM, XJH FROM TOMMY.T_YJS
        WHERE XH=:cardnum`, [cardnum]
              )
              if (record.rows.length > 0) {
                name = record.rows[0][0]
                schoolnum = record.rows[0][1]
              }
            } else if (cardnum.startsWith('10')) {
              // 教职工库
              const record = await db.execute(
                `SELECT XM FROM TOMMY.T_JZG_JBXX
        WHERE ZGH=:cardnum`, [cardnum]
              )
              if (record.rows.length > 0) {
                name = record.rows[0][0]
              }
            }

            if (!name) {
              if (cardnum.startsWith(('213' + new Date().getFullYear().toString().substr(2, 4)))) {
                console.log('新生信息还没有录入，' + new Date().getFullYear() + '级的小可爱不要着急喔～')
              }
              console.log('身份完整性校验失败')
              callback(null)
              await db.close()
              return
            }

            // 生成 32 字节 token 转为十六进制，及其哈希值
            let token = Buffer.from(crypto.randomBytes(20)).toString('hex')
            let tokenHash = hash(token)

            // 防止数据库被挤爆，也为了安全性，先删除用户已有的 repl token
            await db.execute(`DELETE FROM TOMMY.H_AUTH WHERE CARDNUM = :cardnum AND PLATFORM = 'repl'`,
              { cardnum })

            // 将新用户信息插入数据库
            let now = moment()
            // TODO: 向数据库插入记录
            const dbResult = await db.execute(
              `INSERT INTO TOMMY.H_AUTH 
              (TOKEN_HASH, CARDNUM, REAL_NAME, CREATED_TIME, PLATFORM, LAST_INVOKED_TIME, SCHOOLNUM)
              VALUES (:tokenHash, :cardnum, :name, :createdTime, 'repl', :lastInvokedTime, :schoolnum )
              `,
              {
                tokenHash,
                cardnum,
                name,
                createdTime: now.toDate(),
                lastInvokedTime: now.toDate(),
                schoolnum
              }
            )
            if (dbResult.rowsAffected === 1) {
              console.log(`当前认证身份：${cardnum} - ${name} - ${schoolnum}`)
              console.log(`如需调试，在浏览器控制台执行： auth('${token}')`)
              testClient.defaults.headers = { 'x-api-token': token }
            }
            callback(null)
            await db.close()
          })
          return
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
            console.log(`\n登录成功了！`)
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

  require('./replHistory')(replServer, './.repl_history')
}
