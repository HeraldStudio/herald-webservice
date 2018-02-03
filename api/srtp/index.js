const cheerio = require('cheerio')
exports.route = {
  async get() {
    //let { cardnum} = this.user
    let cardnum='213160414'
    let res=await this.post('http://xk.urp.seu.edu.cn/jw_service/service/stuCurriculum.action',`returnStr=&queryStudentId=${cardnum}&queryAcademicYear=17-18-3`)
    if (res.status >= 400) {
      this.throw(res.status)
      return
    }
    let schnub= /\u5b66\u53f7:([^<]+)/.exec(res.data)[1]
    let srtpre=await this.post('http://10.1.30.98:8080/srtp2/USerPages/SRTP/Report3.aspx',`code=${schnub}`)
    if (srtpre.status >= 400) {
      this.throw(res.status)
      return
    }
    let htmls =cheerio.load(srtpre.data)
    let stbody=[]
    htmls('body').children('form').children('table').children('tbody').children('tr').eq(2).children('td').children('div').children('table').children('tbody').children('tr').each(function(i, tr) {
      stbody[i] = htmls(this)
    });
    let srtp=[{
      'name': /\u59d3\u540d\uff1a([^\n\t]+)/.exec(stbody[0].text())[1],
      'card number': cardnum,
      'total': stbody[stbody.length-2].children('td').eq(6).text(),
      'score': stbody[stbody.length-1].children('td').eq(6).text()
    }]
    for(let i=2;i<stbody.length-2;i++){
      srtp.push({
        'type': stbody[i].children('td').eq(0).text().replace(/\s/g, ""),
        'project':  stbody[i].children('td').eq(1).text().replace(/\s/g, ""),
        'date': stbody[i].children('td').eq(2).text().replace(/\s/g, ""),
        'department': stbody[i].children('td').eq(3).text().replace(/\s/g, ""),
        'total credit': stbody[i].children('td').eq(4).text().replace(/\s/g, ""),
        'proportion':  stbody[i].children('td').eq(5).text().replace(/\s/g, ""),
        'credit': stbody[i].children('td').eq(6).text().replace(/\s/g, "")
      })
    }

    return srtp
  }
  }
