// const { url, android, ios } = require('../sdk/sdk.json').tpns
// const axios = require('axios')
// const crypto = require('crypto')
// const generateSign = (config, timestamp, requestBody) => {
//   return Buffer.from(crypto.createHmac('sha256', config.secretKey)
//     .update(timestamp + config.accessID + requestBody).digest('hex')).toString('base64')
// }
// exports.route = {
//   async get() {
//     const requestBody = JSON.stringify({
//       audience_type: 'account',
//       account_list: ['213181432'],
//       message_type: 'notify',
//       message: {
//         title: '测试标题',
//         content: '测试内容',
//         accept_time: [
//           {
//             start: {
//               hour: "10",
//               min: "48"
//             },
//             end: {
//               hour: "10",
//               min: "49"
//             }
//           }
//         ]
//       }
//     })
//     const now = moment().format('X')
//     try {
//       await axios.post(`${url}v3/push/app`,
//         requestBody,
//         {
//           "headers": {
//             'Content-Type': 'application/json',
//             'AccessId': android.accessID,
//             'TimeStamp': now,
//             'Sign': generateSign(android, now, requestBody)
//           }
//         })
//     } catch (err) {
//       console.log(err.response.data.err_msg)
//       throw '推送失败'
//     }
//     return '推送成功'
//   }
// }