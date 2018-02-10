const cheerio = require('cheerio')


exports.route = {

  /**
   * GET /api/lecture
   * 人文讲座信息查询
   *
   **/
  async get() {

    await this.useAuthCookie()
    await this.get('http://allinonecard.seu.edu.cn/ecard/dongnanportalHome.action')
    //获取账号信息
    let res = await this.get("http://allinonecard.seu.edu.cn/accounthisTrjn.action")
    let $ = cheerio.load(res.data)
    let account = $("#account option").attr('value')

    //获取记录页数
    res = await this.post(
      'http://allinonecard.seu.edu.cn/mjkqBrows.action',
      {account: '144038', startDate:'', endDate:''}
    )
    $ = cheerio.load(res.data)
    let pageTotal = $("#pagetotal").text()


    //逐页查询
    for (var i=2;i<=pageTotal;i++){
      res = await this.post(
        'http://allinonecard.seu.edu.cn/mjkqBrows.action',
        {account: '144038', startDate:'', endDate:'', pageno:i}
      )

    }

    return 
  }
}
