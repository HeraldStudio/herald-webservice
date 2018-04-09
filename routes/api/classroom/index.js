let { Campus, Building, Classroom, ClassRecord, DayOfWeek, ClassOfDay } = require("./models")

exports.route = {

  /**
  * GET /api/classroom
  * @apiParam type 要查询的数据类型，不区分大小写
  * @remark 获取某一数据表的所有条目的id与name
  * @note 前端可利用该API准备查询时的下拉框
  **/
  async get({ type }) {

    // 参数检查
    if (typeof type !== "string") {
      throw (400)
    }

    // 转换字符串至对应的类型
    type = Object.entries(require("./models")).find(e => e[0].toLowerCase() === type.toLowerCase())[1]

    if (!type) {
      throw (400)
    }

    // 返回对应类型所有条目的id与name
    return await type.find({}, {id: true, name: true})
  },

  /**
  * POST /api/classroom
  * @remark 爬取学校网站，完整更新一次数据库（校区/建筑/教室/课程数据）
  **/
  async post() {
    // 此API会对数据库进行一次大更新。
    // 为方便处理，加载所有数据到内存中，并将相关方法改为内存版本实现
    await Promise.all([Campus, Building, Classroom, ClassRecord].map(async (c, i, a) => {
      a[i].all = await a[i].find({}) // ClassName.all 获取所有对象
      a[i].findId = (name) => {
        const res = a[i].all.find(o => o.name === name);
        return res && res.id
      }
    }))

    // 方法复用，source提供原始网页数据，regex解析数据，parser将regex的一个match转换为对应的record
    // 整个函数完成一次对某一处课程信息的提取
    async function crawler(source, regex, parser) {
      // 通过parser将正则匹配结果转换为课程条目数组（一次匹配结果可能分成多条记录）
      for (let records; (records = parser(regex.exec(source))); ) {
        records.forEach(record => {
          // 流式编程，处理需要新增校区/建筑/教室信息的情况
          [
            [Object,    record.notExistName],  // 哨兵顶层
            [Campus,    record.campusName],    // 校区，上层
            [Building,  record.buildingName],  // 建筑，中层
            [Classroom, record.classroomName]  // 教室，下层
          ]
          .map(v => v[1] && new v[0]({ // 转换为对应的类对象
            id: v[0].findId(v[1]),
            name: v[1]
          }))
          .reduce((pre, cur, i, a) => {
            let [preName, curName] = [pre, cur].map(v => v && v.constructor.name.toLowerCase())
            if (!cur.id) { // 如果数据库中没有对应id，则新生成一条记录保存
              if (pre) { // 下层对象保存上一层Id
                a[i][preName + "Id"] = pre.id
              }
              a[i].id = Math.max(...a[i].constructor.all.map(o => o.id), 0) + 1 // 取最大Id + 1为新Id，数组为空时最大Id为0
              a[i].constructor.all.push(a[i])
              a[i].save() // await-free
            }
            // 将record中各类name属性转换为Id属性
            record[curName + "Id"] = a[i].id
            delete record[curName + "Name"]
            return a[i] // 传递上层对象给下一层
          })

          record.id = Math.max(...ClassRecord.all.map(o => o.id), 0) + 1 // FIXME：修正autoIncrement的问题
          record = new ClassRecord(record)
          ClassRecord.all.push(record)
          record.save() // await-free
        })
      }
    }

    // 等待所有数据更新完毕
    await Promise.all([
      // 更新研究生数据
      // FIXME: 补全院系编号
      ...[000, 001].map(async department => crawler(
        (await this.post(
          "http://121.248.63.139/nstudent/pygl/kbcx_yx.aspx"//,
          //"drpyx=000" // FIXME 还需要更多参数
        )).data,
        /<td>(.+)<\/td><td>(.+)<\/td><td>([^\s]+)\s*<\/td><td>第(\d+)-(\d+)周;? (.*)<\/td><td>(.+)<\/td><td>([^\w]+)([0-9a-zA-Z]+)<\/td><td>(\d+)<\/td><td>(\d+)<\/td>/img,
        entry => entry && entry[6].split(' ').map(v => v.match(/(星期.)-(.+)/)).map( // 把一星期中上多天的一门课拆成若干个Record
          time => ({
            name          : entry[1],
            courseId      : entry[2],
            courseName    : entry[3],
            startWeek     : parseInt(entry[4]),
            endWeek       : parseInt(entry[5]),
            dayOfWeek     : DayOfWeek[time[1]],
            startSequence : time[2].split(',').map(e => ClassOfDay[e])[0],
            endSequence   : time[2].split(',').map(e => ClassOfDay[e]).slice(-1)[0],
            teacher       : entry[7],
            buildingName  : entry[8],
            classroomName : entry[8] + "-" + entry[9], // 上下三个属性将在crawler中被转换为Id属性
            campusName    : Campus.findName(entry[8]),
            capacity      : parseInt(entry[10]),
            size          : parseInt(entry[11])
          })
        )
      )),
      // 更新本科生课程数据
      // TODO: 补充本科生爬取、解析规则
    ])

    // 成功状态码为201 Created
    this.response.status = 201
  },

  /**
  * PUT /api/classroom
  * @apiParam type       数据的类型("Campus", "Building"等)，不区分大小写，单词需要对应
  * @apiParam values     更新数据数组
  * @remark 通过body json数据来更新数据库
  **/
  async put({ type, values }) {

    // 参数检查
    if (!(typeof type === "string" && typeof values === "object")) {
      throw (400)
    }

    // 确保values为数组形式
    if (!(values instanceof Array)) {
      // values可能为用对象表示的关联数组，此时取其值转成一般数组
      values = Object.values(values)
    }

    // 转换字符串至对应的类型
    type = Object.entries(require("./models")).find(e => e[0].toLowerCase() === type.toLowerCase())[1]

    if (!type) {
      throw (400)
    }

    // 先转换value为对应的类对象，再调用基类的save方法保存到数据库中
    values.map(v => new type(v)).forEach(v => v.save()) // await-free

    // 成功状态码为201 Created
    this.response.status = 201
  }
}
