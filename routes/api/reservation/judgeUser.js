const Cookie = require('tough-cookie').Cookie


exports.route = {
  /**
  * GET /api/reservation/judgeUser
  * 查询用户id
  * @apiParam ids
  * @apiParam useTime
  * @apiParam itemId
  * @apiParam allowHalf
  * @apiParam validateCode
  **/
  async get({ _ids, _useTime, _itemId, _allowHalf, _validateCode, _cookie, _phone }){
    await this.useAuthCookie()

    let cookie = Cookie.parse(_cookie)
    this.cookieJar.setCookie(cookie, 'http://yuyue.seu.edu.cn/eduplus/order/order/', ()=>{
    })
    /*_cookie.split(';').map(k => {
      this.cookieJar.setCookie(k)
      
      let data = k.split('=')
      console.log(data[0])
      console.log(data[1])
      
    })*/
    //console.log(JSON.stringify(data))
    let ids = ''
    // 一个人预约时不需要 ids 字段
    if(_ids){
      if(Array.isArray(_ids)){
        //console.log(_ids)
        _ids.forEach(k=>{
          ids += k + ','
        })
      }
      else{
        ids = _ids + ','
      }
    }
    
    let judge_data = 'ids='+ids+'&useTime='+_useTime+'&itemId='+_itemId+'&allowHalf='+_allowHalf+'&validateCode='+_validateCode
    let msg = await this.post('http://yuyue.seu.edu.cn/eduplus/order/order/judgeUseUser.do?sclId=1', judge_data)
    //console.log(msg.data)

    // TODO 判断违规情况
    
    /*msg = JSON.parse(msg)
    if(msg.useuser){
      let names = ''
      JSON.parse(msg.useuser).map(k => {
        name += k
      })
      return '以下人员无法预约'+name
    }*/

    let final_data = 'orderVO.useTime='+_useTime+'&orderVO.itemId='+_itemId+'&orderVO.useMode='+_allowHalf+
                      '&orderVO.phone='+_phone+'&orderVO.remark=&validateCode='+_validateCode

    if(_ids){
      if(Array.isArray(_ids)){
        _ids.forEach(k=>{
          final_data += '&useUserIds=' + k
        })
      }
      else{
        final_data +='&useUserIds=' + _ids
      }
    }

    msg = await this.post('http://yuyue.seu.edu.cn/eduplus/order/order/order/insertOredr.do?sclId=1', final_data)
    return msg.data.toString()
  }
}