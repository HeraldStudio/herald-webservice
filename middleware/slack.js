/**
 * Created by WolfTungsten on 2018/2/16.
 */

/**
 * 将slack interaction封装成promise
 * **/
const axios = require('axios')
const config = require('../sdk/sdk.json').slack

const _axios = axios.create({
  headers: {
    'Content-type' : 'application/json'
  }
})

const slackMessagePool = {}

/**
 * # SlackMessage
 * 功能：封装发送到slack的消息成promise（模仿控制台回调形式输入）
 *
 * 创建SlackMessage对象后，通过调用send方法发送消息
 * send (text:string, actions:array?, actionConfig:object?) => Promise || true
 * - text 为显示在消息上的文本内容
 *   如果仅包含text，不包含actions，则退化为同步方法
 * - （可选）actions 接受数组对象表示该条消息的所有可用操作,举例：
 *   [
 *      {
 *        name:'accept'， - 操作的name，在actions中唯一，作为interaction消息的await返回结果
 *        text：'接受'， - 显示在按钮上的文字
 *        response：'爬虫认证成功'， - 选中操作后slack中的反馈消息
 *        （可选）style：'primary'， - 按钮样式，默认default，可选值 default、primary、danger
 *        （可选）confirm: {
              title: "Are you sure?",
              text: "Wouldn't you prefer a good game of chess?",
              ok_text: "Yes",
              dismiss_text: "No"
          },
          ...
      ]
 * - （可选）actionConfig 操作的相关设置
 *         {
 *           （可选）title: attachment的title
 *           （可选）color： attachment的颜色
 *          }
 *
 * **/
class SlackMessage {
  send (text, actions, {title='请选择操作', color='#2D9CDB',timeout} = {}) {
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
      attachment.title = title
      attachment.fallback = 'Ooops，你的客户端不支持耶！'
      attachment.callback_id = this.callback_id
      attachment.color = color
      attachment.actions = []
      for (let action of actions) {
        if (!action.hasOwnProperty('name')) {
          throw new Error('必须指定按钮的name')
        }
        if (!action.hasOwnProperty('text')) {
          throw new Error('必须指定按钮的text')
        }
        if (!action.hasOwnProperty('response')) {
          throw new Error('必须指定按钮的response')
        }
        attachment.actions.push({
          name: action.name,
          text: action.text,
          type: 'button',
          style: action.style,
          confirm: action.confirm
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
        if (timeout) {
          //如果设置了超时
          setTimeout(() => {reject('Interact Timeout')}, timeout)
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

  if (ctx.path.includes('/slack')) {
    const bodyparser = require('koa-bodyparser')()
    await bodyparser(ctx, async () => {
      // 截获interaction请求
      if (ctx.path.endsWith('interaction')) {
        let slackRequest = JSON.parse(ctx.request.body.payload)
        let currentMsg = slackMessagePool[slackRequest.callback_id]
        // 将请求的name作为Promise的结果
        currentMsg.resolve(slackRequest.actions[0].name)
        // 返回name的对应结果
        ctx.body = currentMsg.responseHash[slackRequest.actions[0].name]
      }
    })
    return
  }
  // 调用下游中间件
  await next()
}

module.exports = { middleware, SlackMessage }
