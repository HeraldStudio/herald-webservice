const cheerio = require('cheerio')
const jwcUrl = 'http://jwc.seu.edu.cn'

exports.route = {
  /**
   * GET /api/jwc
   * 查询来自 jwc.seu.edu.cn 的通知
   * 返回格式形如
   * { "教务信息": [
   *   { "title": "", "strong": false, "href": "", "date": 2018-01-25T00:00:00.000Z },
   *   ...
   *   ],
   *   ...
   * }
   * "strong" 表示网站上是否以粗体显示。
   **/
  async get() {
    function parseGroupName(item) {
      return $('span span', item).text()
    }

    function parseContent(item) {
      return $('tbody > tr > td > table > tbody > tr', item).toArray().map(i => {
        // 这个 row 里有三项
        // 第一项含有标题，第二项是"NEW"标志，第三项是日期
        let arr = $('td', i).toArray()
        let titleElem = $('a', arr[0])
        let dateElem = $('div', arr[2])
        let cur = {
          // 不用 text 是因为可能里面会有个 <font>
          'title': titleElem.attr('title'),
          // 如果里面套了一个 <font> 就说明是粗体显示的
          'strong': titleElem.find('font').length ? true : false,
          // 绝对路径
          'href': jwcUrl + titleElem.attr('href'),
          // 转化成Date
          'date': new Date(dateElem.text())
        }
        return cur
      })
    }

    let res = await this.get(jwcUrl)
    let $ = cheerio.load(res.data)
    let all = $('table.font3').toArray()
    let ret = {}
    // 取需要的信息
    // [[<组名>, <内容>], ...]
    // 下标是一个一个数出来的
    ;[[3, 5], [6, 8], [9, 11], [12, 14], [15, 17]].map(
      i => {
        ret[parseGroupName(all[i[0]])] = parseContent(all[i[1]])
      })
    return ret
  }
}
