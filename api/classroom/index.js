const models = require("./models")

exports.route = {

  /**
  * POST /api/classrom
  * @remark 更新除教一~教八（校方提供空教室查询）外的其他地方的课程数据
  **/
  async post() {
    let curriculumsURL = "http://121.248.63.139/nstudent/pygl/kbcx_yx.aspx"
    let rawData = (await this.get(curriculumsURL)).data

    let reg = /<td>(.+)<\/td><td>(.+)<\/td><td>([^\s]+)\s*<\/td><td>第(\d+)-(\d+)周 (.+)-(.+)<\/td><td>(.+)<\/td><td>([^\w]+)([0-9a-zA-Z]+)<\/td><td>(\d+)<\/td><td>(\d+)<\/td>/img
    let classRecords = []
    let entry = null
    do {
      entry = reg.exec(rawData)
      if (entry) {
        let classroomName = entry[9] + "-" + entry[10]
        let buildingName = entry[9]
        let campusName = models.Campus.findNameByBuilding(buildingName)

        let campusId = models.Campus.findId(campusName)
        let buildingId = models.Building.findId(buildingName)
        let classroomId = models.Classroom.findId(classroomName)

        if (campusId == null) {
          campusId = Math.max(...Object.keys(models.campuses)) + 1
          models.campuses[campusId] = new models.Campus({ id: campusId, name: campusName })
        }
        if (buildingId == null) {
          buildingId = Math.max(...Object.keys(models.buildings)) + 1
          models.buildings[buildingId] = new models.Building({ id: buildingId, name: buildingName, campusId })
        }
        if (classroomId == null) {
          classroomId = Math.max(...Object.keys(models.classrooms)) + 1
          models.classrooms[classroomId] = new models.Classroom({ id: classroomId, name: classroomName, buildingId })
        }

        classRecords.push(new models.ClassRecord(entry))
      }
    } while (entry)

    let basePath = "./api/spare-classroom/models/"


    this.response.status = 201
  },

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
    values.map(v => new models[type](v)).forEach(v => v.save()) // await-free
    
    // 成功状态码为201 Created
    this.response.status = 201
  }
}
