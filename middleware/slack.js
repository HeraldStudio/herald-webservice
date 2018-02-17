/**
 * Created by WolfTungsten on 2018/2/16.
 */

/**
 * 将slack interaction封装成promise
 * **/
const axios = require('axios');
const config = require('./slack.json');

const _axios = axios.create({
  headers: {
    'Content-type' : 'application/json'
  }
})

const slackMessagePool = {}

/**
 * # SlackMessage对象
 * ## 功能一
 * **/
class SlackMessage {
  send (text, actions, actionConfig = {}) {
    //限定每一条消息至多包含一个操作
    //为操作生成一个callback_id
    this.callback_id = ''
    do {
      this.callback_id = Math.random().toString(36).substr(2)
    } while (slackMessagePool.hasOwnProperty(this.callback_id))

    this.msg = { text }
    let attachment = {}

    if (actions) {
      // 如果包含actions
      attachment.title = actionConfig.title ? actionConfig.title : '请选择操作'
      attachment.fallback = 'Ooops，你的客户端不支持耶！'
      attachment.callback_id = this.callback_id
      attachment.color = actionConfig.color ? actionConfig.color : '#2D9CDB'
      attachment.actions = []
      for (let i in actions) {
        let button = actions[i]
        if (!button.hasOwnProperty('name')) {
          throw Error('必须指定按钮的name')
        }
        if (!button.hasOwnProperty('text')) {
          throw Error('必须指定按钮的text')
        }
        if (!button.hasOwnProperty('response')) {
          throw Error('必须指定按钮的response')
        }
        attachment.actions.push({
          name: button.name,
          text: button.text,
          type: 'button',
          style: button.style,
          confirm: button.confirm
        })
      }

      this.msg.attachments = [attachment]
      slackMessagePool[this.callback_id] = { responseHash:{} }
      let currentMsg = slackMessagePool[this.callback_id]

      for (let i in actions) {
        //捆绑返回文本
        let button = actions[i]
        currentMsg.responseHash[button.name] = button.response
      }

      _axios.post(config.webhookURL, this.msg)

      return new Promise((resolve, reject) => {
        if (actionConfig.timeout) {
          //如果设置了超时
          setTimeout(() => {reject('Interact Timeout')}, actionConfig.timeout)
        }
        currentMsg.resolve = resolve // 将resolve绑定到任务池
      })

    } else {
      _axios.post(config.webhookURL, this.msg)
      return true
    }
  }
}

let middleware = async (ctx, next) => {

  // 截获关于slack的请求

  if (ctx.path === '/slack') {
    const bodyparser = require('koa-bodyparser')()
    await bodyparser(ctx, async () => {
      let slackRequest = JSON.parse(ctx.request.body.payload)
      let currentMsg = slackMessagePool[slackRequest.callback_id]
      // 将请求的name作为Promise的结果
      currentMsg.resolve(slackRequest.actions[0].name)
      // 返回name的对应结果
      ctx.body = currentMsg.responseHash[slackRequest.actions[0].name]
      return
    })
    return
  }
  // 调用下游中间件
  await next()


}

module.exports = { middleware, SlackMessage }
