const cheerio = require('cheerio')

exports.route = {
  async get() {
    await this.useAuthCookie()
    let res = await this.get('http://my.seu.edu.cn/pnull.portal?action=showItem&.ia=false&.pen=pe562&itemId=231&childId=240&page=1')
    //console.log(res.data)
    let { name, cardnum } = this.user
    // // 从总务处网站可以进入到这里，是一个三层框架套住的页面
    // let res = await this.get(`http://hq.urp.seu.edu.cn/epstar/app/template.jsp?mainobj=SWMS/SSGLZXT/SSAP/V_SS_SSXXST&tfile=XSCKMB/BDTAG&filter=V_SS_SSXXST:XH='${cardnum}'`)
    let $ = cheerio.load(res.data)
    this.logMsg = `${name} (${cardnum}) - 查询宿舍信息`
    //console.log($($($('#sb_table').children()[0]).children()[1]).children())
    let data = $($($('#sb_table').children()[0]).children()[1]).children().map(function(){
      return $(this).text().trim()
    }).get()
    let campus = '四牌楼'
    if(data[1].indexOf('梅园') != -1 || data[1].indexOf('桃园') != -1 || data[1].indexOf('橘园') != -1){
      campus = '九龙湖'
    }
    return {
      campus,
      area: data[1],
      building: data[2],
      room: data[3],
      bed: data[4]
    }
  }
}