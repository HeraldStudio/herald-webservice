const cheerio = require('cheerio')

exports.route = {

  /**
   * GET /api/user
   * 用户基本信息查询（老门户版）
   **/
  async get () {
    await this.useAuthCookie()
    let res = await this.get('http://myold.seu.edu.cn/index.portal?.pn=p3447_p3449_p3450')
    let $ = cheerio.load(res.data)
    let [schoolnum, name, cardnum, gender]
      = $('.pa-main-table .portlet-table-even').toArray().map(k => $(k).text().trim())

    gender = gender.replace(/性$/, '')

    return {
      name, cardnum, schoolnum, gender
    }
  }
}

// exports.route = {
//
//   /**
//    * GET /api/user
//    * 用户基本信息查询（一卡通版）
//    **/
//   async get() {
//
//     await this.useAuthCookie()
//     // 带着统一身份认证 Cookie 获取一卡通中心 Cookie；带着一卡通中心 Cookie 抓取一卡通页面
//     await this.get('http://allinonecard.seu.edu.cn/ecard/dongnanportalHome.action')
//     let res = await this.get('http://allinonecard.seu.edu.cn/accountcardUser.action')
//     // 一卡通基本信息
//
//     // 模板应用器
//     function applyTemplate(template, pairs) {
//       for (key in template) {
//         if (template.hasOwnProperty(key)) {
//           if (typeof template[key] === 'string') {
//             template[key] = pairs.filter(pair => pair[0].trim() === template[key].trim())[0]
//             if (template[key]) {
//               template[key] = template[key][1]
//             }
//           } else if (typeof template[key] === 'object') {
//             applyTemplate(template[key], pairs)
//           }
//         }
//       }
//     }
//
//     // 匹配的模式串
//     const columnReg = /[\r\n]([^：\r\n])+：[\s]*([^：]+)(?=[\r\n])/img
//
//     // 返回数据的模板，键值要跟网页中找到的栏目名一致，比如「帐号」不能写成「账号」
//     let info = {
//       name: '姓名',
//       gender: '性别',
//       cardnum: '学工号',
//       identity: '身份类型',
//       id: '证件号码',
//       college: '所属部门',
//     }
//
//     // 直接转文字，根据冒号分隔的固定模式匹配字段名和内容
//     let $ = cheerio.load(res.data)
//     let pairs = $('.neiwen').text().match(columnReg)
//       .map(k => k.replace(/\s+/g, '').split('：', 2))
//       .filter(k => k.length === 2)
//
//     // 将对应的 [字段名, 内容] 二元组列表传入 applyTemplate 工具函数，替换 template 中对应键值
//     applyTemplate(info, pairs)
//     info.schoolnum = this.user.schoolnum
//
//     return info
//   }
// }
