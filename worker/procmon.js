const cp = require('child_process')
const readline = require('readline')

module.exports = class Procmon {
  constructor(command, args = [], options = {}) {
    this.command = command
    this.args = args
    this.maxCpu = 0
    this.maxMem = 0
    this.autoReload = false
    this.killOnExit = true
    this.running = false
    this.repl = false
    this.checkInterval = 5000
    this.checkIntervalHandle = null
    this.onBind = () => { }
    this.onUnbind = () => { }
    Object.assign(this, options)
  }

  start() {
    this.process = cp.spawn(this.command, this.args, this)
    this.running = true
    this.onBind(this.process)

    if (this.killOnExit) {
      process.on('SIGTERM', () => process.exit())
      process.on('SIGINT', () => process.exit())
      process.on('exit', () => this.stop())
    }

    if (this.autoReload) {
      this.process.on('SIGTERM', () => this.running && this.start())
      this.process.on('SIGINT', () => this.running && this.start())
      this.process.on('exit', () => this.running && this.start())
    } else {
      this.process.on('SIGTERM', () => this.stop())
      this.process.on('SIGINT', () => this.stop())
      this.process.on('exit', () => this.stop())
    }

    if (this.repl) {
      this.rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      })

      if (this.repl === true) {
        this.repl = {
          prompt: this.process.pid + ' < ',
          stdout: d => process.stdout.write(this.process.pid + ' > ' + d.toString()),
          stderr: d => process.stderr.write(this.process.pid + ' > ' + d.toString())
        }
      }

      this.process.stdout.on('data', data => {
        readline.clearLine(process.stdout, 0)
        readline.cursorTo(process.stdout, 0)
        this.repl.stdout(data)
        process.stdout.write(this.repl.prompt)
      })
      this.process.stderr.on('data', data => {
        readline.clearLine(process.stdout, 0)
        readline.cursorTo(process.stdout, 0)
        this.repl.stderr(data)
        process.stdout.write(this.repl.prompt)
      })
      let repl = () => {
        this.rl.question(this.repl.prompt, line => {
          this.process.stdin.write(line + '\n')
          repl()
        })
      }

      repl()
    }

    if (this.maxCpu > 0 || this.maxMem > 0) {
      this.checkIntervalHandle = setInterval(() => {
        if (this.running) {
          this.check()
        } else {
          clearInterval(this.checkIntervalHandle)
        }
      }, this.checkInterval)
    }
  }

  check() {
    let { pid } = this.process
    cp.exec(`ps aux ${pid}`, (err, stdout, stderr) => {
      let out = stdout.trim().split('\n')
      if (out.length < 2) {
        if (this.autoReload) {
          this.start()
        }
        return
      }
      let [cpu, mem] = out.slice(-1)[0].split(/\s+/g).slice(2).map(Number)
      if (this.maxCpu > 0 && cpu >= this.maxCpu || this.maxMem > 0 && mem >= this.maxMem) {
        this.stop()

        if (this.autoReload) {
          this.start()
        }
      }
    })
  }

  stop() {
    if (this.running) {
      this.running = false
      this.onUnbind(this.process)
      this.process.kill()
      if (this.rl) {
        this.rl.close()
        delete this.rl
      }
    }
  }
}