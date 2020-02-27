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

if (program.mode === 'production' || program.mode === 'profile') {
  spinner.start()
}

const updateConnections = (count) => {
  spinner.text = count + ' 个请求运行中'
}

let connections = 0
if(program.mode === 'profile'){
  updateConnections(0)
}
for (let key in console) {
  [console['_' + key], console[key]] = [console[key], function() {
    spinner.stop()
    console['_' + key].apply(undefined, arguments)
    if (program.mode === 'production' || program.mode === 'profile') {
      spinner.start()
    }
  }]
}


module.exports = async (ctx, next) => {
  if(program.mode === 'profile'){
    updateConnections(++connections)
  }
  try {
    await next()
  } finally {
    if(program.mode === 'profile'){
      updateConnections(++connections)
    }
  }
}

// 可导入本模块之后取 connections 获得当前连接数
Object.defineProperty(module.exports, 'connections', {
  get () {
    return connections
  }
})
