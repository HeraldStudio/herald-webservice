/**
  # 计数器中间件

  在命令行最后一行显示当前请求计数器
 */
const ora = require('ora')

const spinner = ora({
  spinner: {
    interval: 100,
    frames: ['→']
  }
})

if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'profile') {
  spinner.start()
}

const updateConnections = (count) => {
  spinner.text = count + ' 个请求运行中'
}

let connections = 0
updateConnections(0)
for (let key in console) {
  [console['_' + key], console[key]] = [console[key], function() {
    spinner.stop()
    console['_' + key].apply(undefined, arguments)
    if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'profile') {
      spinner.start()
    }
  }]
}

console.log('')

module.exports = async (ctx, next) => {
  updateConnections(++connections)
  try {
    await next()
  } finally {
    updateConnections(--connections)
  }
}

// 可导入本模块之后取 connections 获得当前连接数
Object.defineProperty(module.exports, 'connections', {
  get () {
    return connections
  }
})
