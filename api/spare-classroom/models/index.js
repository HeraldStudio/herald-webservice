// FIXME 静态引入不会随 json 变动，考虑改为用时读文件
let classRecords   = require("./class-records.json");
let classrooms     = require("./classrooms.json");
let buildings      = require("./buildings.json");
let campuses       = require("./campuses.json");
let classroomTypes = require("./classroom-types.json");

class ModelBase { // 如有必要，通过学校接口返回的JSON中的杂七杂八的属性也可设置于此
  constructor(obj) {
    this.id   = obj.id;
    this.name = obj.name;
  }

  static _findPropIdByName(propSet, name) {
    let entry = Object.entries(propSet).find(e => e[1].name === name);
    return typeof entry === 'undefined' ? null : parseInt(entry[0]);
  }
}

class Campus extends ModelBase {
  constructor(obj) {
    super(obj);
  }

  static findIdByName(name) {
    return this._findPropIdByName(campuses, name)
  }

  static findNameByBuilding(buildingName) {
    if (buildingName.includes("教")) {
      return "九龙湖";
    } else if (buildingName.includes("纪忠楼")) {
      return "九龙湖纪忠楼";
    } else if (buildingName.includes("无线谷")) {
      return "无线谷";
    } else if (buildingName.includes("无锡分校")) {
      return "无锡分校"
    } else {
      return "四牌楼";
    }
  }
}

class Building extends ModelBase {
  constructor(obj) {
    super(obj);
    this.campusId = obj.campusId || obj.campus.id;
    this.campus   = new Campus(campuses[this.campusId]);
  }

  static findIdByName(name) {
    return this._findPropIdByName(buildings, name)
  }
}

class Classroom extends ModelBase {
  constructor(obj) {
    super(obj);
    this.buildingId        = obj.buildingId || obj.building.id;
    this.building          = new Building(buildings[this.buildingId]);
    this.classroomTypeList = obj.classroomTypeList || [];
    this.classroomTypeList.forEach((k, i) => this.classroomTypeList[i] = new ClassroomType(k));
  }

  static findIdByName(name) {
    return this._findPropIdByName(classrooms, name)
  }
}

class ClassroomType extends ModelBase {
  constructor(obj) {
    super(obj);
  }

  static findIdByName(name) {
    return this._findPropIdByName(classroomTypes, name)
  }
}

class ClassRecord {
  constructor(entry) {
    this.className   = entry[1]; // 班级名
    this.courseId    = entry[2];
    this.courseName  = entry[3]; // 课程名
    this.startWeek   = parseInt(entry[4]);
    this.endWeek     = parseInt(entry[5]);
    this.dayOfWeek   = DayOfWeek[entry[6]]; // 星期几的对应编号
    this.sequences   = entry[7].split(',').map(e => ClassOfDay[e]);// 课程节次范围
    this.teacher     = entry[8];
    this.buildingId  = Building.findIdByName(entry[9]);
    this.classroomId = Classroom.findIdByName(entry[9] + "-" + entry[10]);
    this.campusId    = Campus.findIdByName(Campus.findNameByBuilding(entry[9]));
    this.capacity    = parseInt(entry[11]); // 最大容纳人数
    this.size        = parseInt(entry[12]); // 实际选课人数
  }
}

const DayOfWeek = {
  "星期一": 1,
  "星期二": 2,
  "星期三": 3,
  "星期四": 4,
  "星期五": 5,
  "星期六": 6,
  "星期日": 7,
}

const ClassOfDay = {
  "上午1": 1,
  "上午2": 2,
  "上午3": 3,
  "上午4": 4,
  "上午5": 5,
  "下午1": 6,
  "下午2": 7,
  "下午3": 8,
  "下午4": 9,
  "下午5": 10,
  "晚上1": 11,
  "晚上2": 12,
  "晚上3": 13,
}

module.exports = {
  classRecords: classRecords,
  classrooms: classrooms,
  buildings: buildings,
  campuses: campuses,
  classroomTypes: classroomTypes,
  Campus: Campus,
  Building: Building,
  Classroom: Classroom,
  ClassroomType: ClassroomType,
  ClassRecord: ClassRecord,
  DayOfWeek: DayOfWeek,
  ClassOfDay: ClassOfDay
}
