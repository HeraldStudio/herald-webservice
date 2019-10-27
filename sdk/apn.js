const apn = require('apn')
const token = require('./apn-secret/apn-token.json')
const mongodb = require('../database/mongodb')

var options = {
  token,
  production: false
}

let apnProvider 
try{
  apnProvider  = new apn.Provider(options)
}catch(e){
  console.log('apn-token.json未配置')
}

const pushApnByCardnum = async (cardnum, title, body) => {
  try {
    let tokenCollection = await mongodb('herald_ios_device_token')
    let record = await tokenCollection.findOne({ cardnum })
    if (record) {
      let deviceToken = record.deviceToken.split(' ').join('')
      let note = new apn.Notification()
      note.expiry = Math.floor(Date.now() / 1000) + 3600 // Expires 1 hour from now.
      note.badge = 520
      //note.sound = "ping.aiff";
      note.alert = { title, body }
      note.payload = { 'messageFrom': 'John Appleseed' }
      note.topic = 'cn.myseu.ios'
      return await apnProvider.send(note, [deviceToken])
    }
  }catch(e){
    console.log('apn-token.json未配置')
  }
    
}

module.exports = { pushApnByCardnum }