const cheerio = require('cheerio')

exports.route = {

  /**
  * GET /api/library
  * 图书馆信息查询
  **/
  async get() {
    const { cardnum } = this.user
    //const db = await oracle.getConnection()
    // 查询借阅信息

    let record = await this.db.execute(`
      SELECT 
        TSTM,TSMC,JSRQ,YHRQ,WID,XJBS,SFRZH
      FROM
        TOMMY.T_TS_JY_WGH
      WHERE
        DZTM = :cardnum
      `, { cardnum: cardnum})

    //测试
    // let record = await this.db.execute(`
    //   SELECT 
    //     TSTM,TSMC,JSRQ,YHRQ,WID,XJBS,SFRZH
    //   FROM
    //     TOMMY.T_TS_JY_WGH
    //   WHERE
    //     DZTM = 220161235
    //   `)

    //console.log(record)
    return record.rows.map(row => {
      const info = {
        bookId: row[0],
        name: row[1],
        borrowDate: row[2].valueOf(), //日期转为时间戳
        returnDate: row[3].valueOf(),
        WID: row[4],
        renewCount:row[5],
        SFRZH:row[6]
      }
      //console.log(info)
      return info
    });

  
    // return await this.userCache('1m+', async () => {
    //   await this.useAuthCookie()
    //   await this.get('http://www.libopac.seu.edu.cn:8080/reader/hwthau.php')

    //   // 当前借阅
    //   let res = await this.get('http://www.libopac.seu.edu.cn:8080/reader/book_lst.php')
    //   let $ = cheerio.load(res.data)
    //   return $('#mylib_content tr').toArray().slice(1).map(tr => {
    //     let [bookId, name, borrowDate, returnDate, renewCount, location, addition]
    //       = $(tr).find('td').toArray().map(td => $(td).text().trim())
    //     let borrowId = $(tr).find('input').attr('onclick').substr(20, 8)

    //     // 合在一起的信息尽量分开；日期时间都转成时间戳；一定是数字的字段不要用字符串
    //     let [bookName, author] = name.split(/\s*\/\s*/g)
    //     name = bookName
    //     author = author.replace(/编?著?$/, '')
    //     borrowDate = +moment(borrowDate)
    //     returnDate = +moment(returnDate)
    //     renewCount = parseInt(renewCount)

    //     return { bookId, name, author, borrowDate, returnDate, renewCount, location, addition, borrowId }
    //   })
  // })
  },

  /**
  * POST /api/library
  * @apiParam bookId
  * 图书续借
  **/
  async post({ bookId }) {
    await this.useAuthCookie()
    await this.get('http://www.libopac.seu.edu.cn:8080/reader/hwthau.php')
    let res = await this.get('http://www.libopac.seu.edu.cn:8080/reader/book_lst.php')
    let $ = cheerio.load(res.data)

    let bookList = $('#mylib_content tr').toArray().slice(1).map(tr => {
      let bookId = $(tr).find('td').toArray().map(td => {
        return $(td).text().trim()
      })[0]
      let borrowId = $(tr).find('input').attr('onclick').substr(20,8)
      return { bookId, borrowId }
    })

    let { borrowId } = bookList.find(k => k.bookId === bookId)
    let captcha = await this.libraryCaptcha()
    let time = +moment()

    res = await this.get('http://www.libopac.seu.edu.cn:8080/reader/ajax_renew.php', {
      params: {
        bar_code: bookId,
        check: borrowId,
        captcha, time
      }
    })
    return cheerio.load(res.data).text()
  }
}
