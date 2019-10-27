const cheerio = require('cheerio')

exports.route = {
    
  /**
  * POST /api/reservation
  * @apiParam time
  * @apiParam dayInfo
  * @apiParam itemId
  * 预约场馆 初始化
  **/
  async get({ time, dayInfo, itemId}) {
    await this.useAuthCookie()
    let msg = await this.post('http://yuyue.seu.edu.cn/eduplus/order/order/judgeOrder.do?sclId=1',{
      time: time,
      itemId: itemId,
      dayInfo: dayInfo
    })
    msg = msg.data.toString()

    if(msg === '1'){
      return '预约时间已过！'
    }else if(msg === '6'){
      return '非预约时间段不能进行预约操作！'
    }else if(msg === '2'){
      return '该时间已有其他预约！'
    }else if(msg === '3'){
      return '本日预约已经达到最大限制！'
    }else if(msg === '4'){
      return '本项目预约已经达到最大限制！'
    }else if(msg === '5'){
      return '您已被冻结，无法进行预约！'
    }
    
    // 可以继续预约
    
    let init = await this.get('http://yuyue.seu.edu.cn/eduplus/order/order/initEditOrder.do?sclId=1&dayInfo='+dayInfo+'&itemId='+itemId+'&time='+time)
    let cookie = init.config.headers.Cookie
    let $ = cheerio.load(init.data)
    
    phone = $('#phone').attr('value')
    half = $('#half').text()
    full = $('#full').text()
    let validateBuffer = await this.get('http://yuyue.seu.edu.cn:80/eduplus/control/validateimage')
    let validateImage = validateBuffer.data.toString('base64')
    
    while(!/^\/9j/.test(validateImage)){
      validateBuffer = await this.get('http://yuyue.seu.edu.cn:80/eduplus/control/validateimage')
      validateImage = validateBuffer.data.toString('base64')
      //console.log('require validate image again')
    }
    return {
      phone: phone,
      half: half,
      full: full,
      validateImage: validateImage,
      cookie: cookie
    }
    /**
 * 2018-10-01
 * 7
 * 09:00-10:00
*/
  }
}