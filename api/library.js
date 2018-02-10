const cheerio = require('cheerio')

exports.route = {

  /**
   *
   * POST /api/library
   * @apiParam password
   * 图书馆信息查询
   *
   **/
  async post() {
    let { cardnum } = this.user
    let { password } = this.params

    //  获取解析后的验证码与Cookie并登陆
    let res = (await this.get('https://boss.myseu.cn/libcaptcha/')).data
    let { cookies, captcha } = res
    this.cookieJar.setCookieSync(cookies, 'http://www.libopac.seu.edu.cn:8080/reader/redr_verify.php', {})

    await this.post(
      'http://www.libopac.seu.edu.cn:8080/reader/redr_verify.php',
      { number: cardnum, passwd: password, captcha: captcha, select: 'cert_no'}
    )


    // 当前借阅
    res = await this.get(
      'http://www.libopac.seu.edu.cn:8080/reader/book_lst.php'
    )
    let $ = cheerio.load(res.data)
    let bookList = $('#mylib_content tr').toArray().slice(1).map(tr => {
      let [bookId, name, borrowDate, returnDate, times, place, addition]
      = $(tr).find('td').toArray().map(td => {
        return $(td).text().trim()
      })

      let borrowId = $(tr).find('input').attr('onclick').substr(20,8)

      return {bookId, name, borrowDate, returnDate, times, place, addition, borrowId}
    })

    return {cookies, bookList}
  },

  /**
   *
   * GET /api/library
   * @apiParam cookies
   * @apiParam bookId
   * @apiParam borrowId
   * 图书续借
   *
   **/

   async get(){
     let {cookies, bookId, borrowId} = this.params;
     let time = new Date().getTime()

     let res = (await this.get("https://boss.myseu.cn/libcaptcha/?cookie="+cookies+"PHPSESSID=1tu1epdtevrtg704np09n9ifd7")).data
     let { captcha } = res
     res = await this.get(
       'http://www.libopac.seu.edu.cn:8080/reader/book_lst.php',{
         params:{
           bar_code:bookId,
           check:borrowId,
           captcha:captcha,
           time:time
         }
       }
     )
     
     return res.data

   }

}
