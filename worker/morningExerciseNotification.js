const axios = require('axios')

process.on('message', async (templateMessage) => {
  let touser = templateMessage.touser
  let accessToken = templateMessage.accessToken
  templateMessage.accessToken = null
  templateMessage.touser = null
  let amount = 0, count = 0
  for (let openid of touser) {
    // 浅复制即可，想想为什么？
    let message = Object.assign({}, templateMessage)
    message.touser = openid
    amount++
    try {
      let pushRes = await axios.post(`https://api.weixin.qq.com/cgi-bin/message/template/send?access_token=${accessToken}`, message)
      if (pushRes.data.errmsg === 'ok') {
        count++
      }
    } catch (e) {
      console.log(e.message)
    }

  }
  process.send({ success: true, amount, count })
})
