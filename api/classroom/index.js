let { Campus, Building, Classroom, ClassRecord, DayOfWeek, ClassOfDay } = require("./models")

exports.route = {

  /**
   * POST /api/classroom
   * @remark 爬取学校网站，完整更新一次数据库（校区/建筑/教室/课程数据）
   **/
  async post() {
    // 此API会进行一次大更新。为方便处理，此处加载所有数据到内存中，并将相关方法改为内存版本实现
    [Campus, Building, Classroom, ClassRecord].forEach((c, i, a) => {
      // FIXME: 改为index索引
      ;[c._all, c.all] = [c.all, await c.all()] // ClassName.all 获取所有对象
      ;[c._findId, c.findId] = [c.findId, (name) => c.all.find(o => o.name == name).Id]
    })

    // 方法复用，provider函数获取原始网页数据，regex解析数据，parser将regex的一个match转换为对应的record
    // 整个函数完成一次对某一处课程信息的提取
    async function crawler(provider, regex, parser) {
      for (let entry, record
          // 通过parser将正则匹配结果转换为课程条目
          ;(entry = regex.exec(await provider())) && (record = await parser(entry))
          ; ) {
        // 流式编程，处理需要新增校区/建筑/教室信息的情况
        ;[
          [Capmus, Campus.findName(entry[9])]      // 校区名
          [Building, entry[9]],                    // 建筑名
          [Classroom, entry[9] + "-" + entry[10]], // 教室名
        ]
        .map(v => new v[0]({
          id: v[0].findId(v[1]),
          name: v[1]
        }))
        .reduce((pre, cur) => {
          // 如果数据库中没有对应id，则新生成一个保存
          if (!cur.id) {
            // 下层对象保存上一层Id         
            if (pre) {
              cur[pre.constructor.name.toLowerCase() + "Id"] = pre.id    
            }
            cur.id = Math.max(...cur.constructor.all.map(o => o.id)) + 1 // 取最大Id + 1为新Id
            cur.constructor.all.push(cur)
            cur.save() // await-free
          }
          return cur // 传递上层对象给下一层
        })

        // TODO: 可能需要先等待新增的校区/建筑/教室保存完毕
        record.save() // await-free
      }
    }

    await crawler(
      async () => (await this.post(
        "http://121.248.63.139/nstudent/pygl/kbcx_yx.aspx", 
        "drpyx=000"
      )).data,
      /<td>(.+)<\/td><td>(.+)<\/td><td>([^\s]+)\s*<\/td><td>第(\d+)-(\d+)周 (.+)-(.+)<\/td><td>(.+)<\/td><td>([^\w]+)([0-9a-zA-Z]+)<\/td><td>(\d+)<\/td><td>(\d+)<\/td>/img,
      async entry => new ClassRecord({
        name          : entry[1], // 班级名  
        courseId      : entry[2],
        courseName    : entry[3], // 课程名
        startWeek     : parseInt(entry[4]),
        endWeek       : parseInt(entry[5]),
        dayOfWeek     : DayOfWeek[entry[6]], // 星期几的对应编号
        startSequence : entry[7].split(',').map(e => ClassOfDay[e])[0], // 课程节次范围
        endSequence   : entry[7].split(',').map(e => ClassOfDay[e]).slice(-1)[0],
        teacher       : entry[8],
        buildingId    : await Building.findId(entry[9]),
        classroomId   : await Classroom.findId(entry[9] + "-" + entry[10]),
        campusId      : await Campus.findId(Campus.findName(entry[9])),
        termId        : ClassRecord.currentTermId(),
        capacity      : parseInt(entry[11]), // 最大容纳人数
        size          : parseInt(entry[12])  // 实际选课人数
      })
    )

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
      throw (400)
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
