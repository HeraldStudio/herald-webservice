const moment = require('moment')
const uuid = require('uuid/v4')
const oracledb = require('oracledb')
const JPushKeys = require('../../../sdk/sdk.json').JPush
const Base64 = require('js-base64').Base64
const axios =require('axios')

exports.route = {
  /**
   * POST /api/notification/ourNotification
   * /api/notification/ourNotification?title=zzj&content=zzj&target=test
   * @param title     String         标题
   * @param content   String         内容
   * @param target    String/Array   目标
   */
  async post({ title, content, target, annex = ''}) {

    // 开发测试环境
    if(program.mode === 'development' || target === 'test'){
      target = ['213171610']
    }
    
    if(!(title && content)){
      throw '缺少标题或者内容'
    }

    if(!target){
      throw '缺少目标'
    }else{
      // 转换一下 target
      if(target === 'all'){
        let record = await this.db.execute(`
        SELECT DISTINCT(CARDNUM) FROM H_AUTH WHERE PLATFORM LIKE '%app%' `)
        target = record.rows.map(student => student[0])
      }
    }
    
    // 鉴权
    if (!(await this.hasPermission('publicity'))) {
      throw 403
    }

    // 将通知存入oracle
    const id = uuid()
    await this.db.execute(`
      INSERT INTO H_NOTIFICATION
      (ID, TITLE, CONTENT, PUBLISHER, PUBLISHTIME, ROLE, TAG, ANNEX, SOURCE, PUBLISHERNAME)
      VALUES(:id, :title, :content, :cardnum, :time, :role, :tag, :annex, :source, :name)
      `, 
    {
      id,
      title,
      content,
      cardnum:this.user.cardnum,
      time: +moment(),
      role: '开发者',
      tag: '小猴偷米',
      annex,
      source: '小猴偷米',
      name: this.user.name
    })
    
    // 插入与接受者的绑定记录
    const sql = `INSERT INTO H_NOTIFICATION_ISREAD （NOTIFICATION_ID, CARDNUM） VALUES (:notificationId, :cardnum)`
    let binds =target.map(item => {
      return { 
        notificationId: id,
        cardnum: item
      }
    })
    const options = {
      autoCommit: true,
      bindDefs: {
        notificationId: { type: oracledb.STRING, maxSize: 40 },
        cardnum: { type: oracledb.STRING, maxSize: 10 }
      }
    }
    await this.db.executeMany(sql, binds, options)

    // 设置推送
    const authorizationCode = Base64.encode(JPushKeys.appKey + ':' + JPushKeys.masterSecret)
    /**
     * 根据「极光」的 API 文档，尽量不调用 audience:'all'
     * 
     * 设置推送body
     */
    const notificationbody = {
      platform: ["android"],  //我们也就开发了两个平台的应用
      audience: {
        alias: target
      },
      notification:{
        android: {
          alert:content,
          title,
          extras:{
            id
          }
        },
        ios:{
          alert: content,
          extras: {
            id      
          }
        }
      }
    }
    let res
    try{
      res = await axios.post('https://bjapi.push.jiguang.cn/v3/push',
        JSON.stringify(notificationbody),
        {
          "Content-Type": "application/json",
          "headers": {Authorization:'Basic ' + authorizationCode}
        })
    }catch(e){
      console.log(e.response.data)
    }
    

    console.log(res.data)
    return 'ok'
  },

}