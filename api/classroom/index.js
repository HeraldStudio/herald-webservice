let {Campus, Building, Classroom, ClassRecord} = require("./models")

exports.route = {

  /**
   * POST /api/classroom
   * @remark 爬取学校网站，完整更新一次数据库（校区/建筑/教室/课程数据）
   **/
  async post() {
    // 此API代表一次大更新。为方便处理，此处加载所有数据到内存中，并将相关方法改为内存版本实现
    [Campus, Building, Classroom, ClassRecord].forEach(c => {
      ;[c._all, c.all] = [c.all, await c.all()] // ClassName.all 获取所有对象
      ;[c._findId, c.findId] = [c.findId, (name) => c.all.find(o => o.name == name).Id]
    })
    
    let url = "http://121.248.63.139/nstudent/pygl/kbcx_yx.aspx"
        rawData = (await this.get(url)).data
        reg = /<td>(.+)<\/td><td>(.+)<\/td><td>([^\s]+)\s*<\/td><td>第(\d+)-(\d+)周 (.+)-(.+)<\/td><td>(.+)<\/td><td>([^\w]+)([0-9a-zA-Z]+)<\/td><td>(\d+)<\/td><td>(\d+)<\/td>/img
        entry = null
    do {
      entry = reg.exec(rawData)
      if (entry) {
        // 流式编程，处理需要新增校区/建筑/教室信息的情况
        [
          [Capmus,    Campus.findName(entry[9])]   // 校区名
          [Building,  entry[9]],                   // 建筑名
          [Classroom, entry[9] + "-" + entry[10]], // 教室名
        ]
        .map(v => new v[0]({
          id: v[0].findId(v[1]), 
          name: v[1]
        }))
        .reduce((pre, cur) => {
          // 如果数据库中没有对应id，则新生成一个保存
          if (!cur.id) {
            cur.id = Math.max(...cur.constructor.all.map(o => o.id)) + 1 // 取最大Id + 1为新Id
            if (pre) {
              cur[pre.constructor.name.toLowerCase() + "Id"] = pre.id    // 下层对象保存上一层Id
            }
            cur.constructor.all.push(cur)
            cur.save() // await-free
          }
          // 传递上层对象给下一层
          return cur
        })
        
        // TODO: 可能需要先等待新增的校区/建筑/教室保存完毕
        (await ClassRecord.create(entry)).save() // await-free
      }
    } while (entry)

    // 成功状态码为201 Created
    this.response.status = 201
  },

  /**
   * PUT /api/classroom
   * @remark 通过body json数据来更新数据库
   **/  
  async put() {
    let { type, values } = this.params

    // 参数检查
    if (!(typeof type === "string" && typeof values === "object")) {
      throw(400)
    }

    // 确保values为数组形式
    if (!(values instanceof Array)) {
      // values可能为用对象表示的关联数组，此时取其值转成一般数组
      values = Object.values(values)
    }

    // 规范化type字符串的格式（首字母大写，其余保持小写）
    type = type[0].toUpperCase() + type.slice(1).toLowerCase()

    // 先转换value为对应的类对象，再调用基类的save方法保存到数据库中
    // 如果此时抛出了异常（如type不存在等），则自动返回400
    values.map(v => new require("./models")[type](v)).forEach(v => v.save()) // await-free
    
    // 成功状态码为201 Created
    this.response.status = 201
  }
}
