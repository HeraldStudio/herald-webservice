let models = require("./models");
let fs = require("fs");

exports.route = {

  /**
  * POST /api/spare-classrom/update
  * @remark 更新除教一~教八（校方提供空教室查询）外的其他课程数据
  **/
  async post() {
    let curriculumsURL = "http://121.248.63.139/nstudent/pygl/kbcx_yx.aspx";
    let rawData = (await this.axios.get(curriculumsURL)).data;

    let reg = /<td>(.+)<\/td><td>(.+)<\/td><td>([^\s]+)\s*<\/td><td>第(\d+)-(\d+)周; (.+)-(.+)<\/td><td>(.+)<\/td><td>([^\w]+)([0-9a-zA-Z]+)<\/td><td>(\d+)<\/td><td>(\d+)<\/td>/img;
    let classRecords = [];
    let entry = null;
    do {
      entry = reg.exec(rawData);
      if (entry) {
        let classroomName = entry[9] + "-" + entry[10];
        let buildingName = entry[9];
        let campusName = models.Campus.findNameByBuilding(buildingName);

        let campusId = models.Campus.findIdByName(campusName);
        let buildingId = models.Building.findIdByName(buildingName);
        let classroomId = models.Classroom.findIdByName(classroomName);

        if (campusId == null) {
          campusId = Math.max(...Object.keys(models.campuses)) + 1;
          models.campuses[campusId] = new models.Campus(campusId, campusName);
        }
        if (buildingId == null) {
          buildingId = Math.max(...Object.keys(models.buildings)) + 1;
          models.buildings[buildingId] = new models.Building(buildingId, buildingName, campusId);
        }
        if (classroomId == null) {
          classroomId = Math.max(...Object.keys(models.classrooms)) + 1;
          models.classrooms[classroomId] = new models.Classroom(classroomId, classroomName, buildingId);
        }
        
        classRecords.push(new models.ClassRecord(entry));        
      }
    } while (entry);

    await fs.writeFile("./api/spare-classroom/models/campuses.json", JSON.stringify(models.campuses, null, space=2));
    await fs.writeFile("./api/spare-classroom/models/buildings.json", JSON.stringify(models.buildings, null, space = 2));
    await fs.writeFile("./api/spare-classroom/models/classrooms.json", JSON.stringify(models.classrooms, null, space = 2));
    await fs.writeFile("./api/spare-classroom/models/class-records.json", JSON.stringify(classRecords, null, space = 2));

    this.response.status = 201;
  }
}
