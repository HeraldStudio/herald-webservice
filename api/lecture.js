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
      {account: account, startDate:'', endDate:''}
    )
    $ = cheerio.load(res.data)
    let pageTotal = $("#pagetotal").text()

    //单独获取第一页的数据
    let lectureList = $(".dangrichaxun tr").toArray().slice(1,-2).map(tr => {
      let td = $(tr).find('td')
      let where = td.eq(-1).text()
      let time = td.eq(0).text()
      return {time,where}
    })

    //逐页查询
    for (var i=2;i<=pageTotal;i++){
      res = await this.post(
        'http://allinonecard.seu.edu.cn/mjkqBrows.action',
        {account: account, startDate:'', endDate:'', pageno:i}
      )
      $ = cheerio.load(res.data)
      $(".dangrichaxun tr").toArray().slice(1,-1).map(tr => {
        let td = $(tr).find('td')
        let where = td.eq(-1).text()
        let time = td.eq(0).text()
        lectureList.push({time,where})
      })
    }

    //判断条件（参考了上一版Python代码）
    const filterParms = ['九龙湖', '手持考', '行政楼', '网络中', '机电大', '校医院', '研究生']
    const placeFilter = value => {
      return filterParms.indexOf(value['where'].substr(0,3)) == -1
    }

    //根据判断条件筛选lectureList
    let realList = lectureList.filter(placeFilter)

    return realList
  }
}

