let models = require("./models");
let fs = require("fs");

exports.route = {

  /**
  * POST /api/spare-classrom/update
  * @remark 更新除教一~教八（校方提供空教室查询）外的其他地方的课程数据
  **/
  async post() {
    let curriculumsURL = "http://121.248.63.139/nstudent/pygl/kbcx_yx.aspx";
    let rawData = (await this.get(curriculumsURL)).data;

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
          models.campuses[campusId] = new models.Campus({ id: campusId, name: campusName });
        }
        if (buildingId == null) {
          buildingId = Math.max(...Object.keys(models.buildings)) + 1;
          models.buildings[buildingId] = new models.Building({ id: buildingId, name: buildingName, campusId });
        }
        if (classroomId == null) {
          classroomId = Math.max(...Object.keys(models.classrooms)) + 1;
          models.classrooms[classroomId] = new models.Classroom({ id: classroomId, name: classroomName, buildingId });
        }

        classRecords.push(new models.ClassRecord(entry));
      }
    } while (entry);

    let basePath = "./api/spare-classroom/models/";

    (async () => {
      await fs.writeFile(basePath + "campuses.json", JSON.stringify(models.campuses, null, 2));
      await fs.writeFile(basePath + "buildings.json", JSON.stringify(models.buildings, (k, v) => k === "campus" ? undefined : v, 2));
      await fs.writeFile(basePath + "classrooms.json", JSON.stringify(models.classrooms, (k, v) => k === "building" ? undefined : v, 2));
      await fs.writeFile(basePath + "class-records.json", JSON.stringify(classRecords, null, 2));
    })()

    this.response.status = 201;
  }
}
