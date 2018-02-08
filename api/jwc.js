const cheerio = require('cheerio')
const baseUrl = 'http://jwc.seu.edu.cn'
const list = [['#wp_news_w5', "教务信息"],['#wp_news_w6', "学籍管理"],['#wp_news_w7', "实践教学"],['#wp_news_w8', "国际交流"],['#wp_news_w9', "教学研究"],]

/*
返回格式
[{
  frag: string //所属栏目
  title: string //题目
  url: string
  time： string //发布时间
  isweb: bool //是否包含详情页
  strong: bool //是否为重要
},
...]
 */

exports.route = {
  async get(){

    let count = 0
    let timeList = []
    let data = {
      item: [],
    }

    let res = await this.get(baseUrl)
    let $ = cheerio.load(res.data)

    list.forEach(ele => {
        $(ele[0]).find('div').toArray().filter(arr => {
            return /\d+-\d+-\d+/.test($(arr).text())
        }).map(item => {
            timeList.push($(item).text())
        })
    })

    list.forEach(ele => {
        $(ele[0]).find('a').toArray().map(item => {
            res = $(item)
            data.item.push({
                frag: ele[1],
                tltle: res.attr('title'),
                url: baseUrl + res.attr('href'),
                time: timeList[count],
                isWeb: /.+.htm$/.test(res.attr('href')),
                strong: res.find('font').length ? true : false,
            })
            count++
        })
    })

    return data.item
  }
}
