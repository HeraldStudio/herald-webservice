exports.route = {
  async get() {
    return await this.userCache('1mo+', async () => {
      const { cardnum } = this.user
      if (!cardnum.startsWith('213')) {
        throw '只允许本科生查询'
      }
      let record = await this.db.execute(
        `select T_BZKS.SSFJH from TOMMY.T_BZKS
      where XH= :cardnum
      `, [cardnum])

      let result = record.rows.map(Element => {
        let [SSFJH] = Element
        return { SSFJH }
      })
      return result
    })
    // await this.useAuthCookie()
    // let res = await this.get('http://my.seu.edu.cn/pnull.portal?action=showItem&.ia=false&.pen=pe562&itemId=231&childId=240&page=1')
    // //let { name, cardnum } = this.user

    // let $ = cheerio.load(res.data)
    // this.logMsg = `${name} (${cardnum}) - 查询宿舍信息`
    // let data = $($($('#sb_table').children()[0]).children()[1]).children().map(function(){
    //   return $(this).text().trim()
    // }).get()
    // let campus = '四牌楼'
    // if(data[1].indexOf('梅园') != -1 || data[1].indexOf('桃园') != -1 || data[1].indexOf('橘园') != -1){
    //   campus = '九龙湖'
    // }
    // return {
    //   campus,
    //   area: data[1],
    //   building: data[2],
    //   room: data[3],
    //   bed: data[4]
    // }
  }
}