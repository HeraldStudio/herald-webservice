export class Campus {
  constructor() {
    this.Id = arguments[0];
    this.name = arguments[1];
  }
}

export class Building {
  constructor() {
    this.Id = arguments[0];
    this.name = arguments[1];
    this.campusId = arguments[2];
  }
}

export class Classroom {
  constructor() {
    this.Id = arguments[0];
    this.name = arguments[1];
    this.buildingId = arguments[2];
  }
}

export class ClassRecord {
  constructor(entry) {
    this.className = entry[1]; // 班级名
    this.courseId = entry[2];
    this.courseName = entry[3]; // 课程名
    this.startWeek = parseInt(entry[4]);
    this.endWeek = parseInt(entry[5]);
    this.dayOfWeek = DayOfWeek[entry[6]]; // 星期几的对应编号
    this.sequences = entry[7].split(',').map(e => ClassOfDay[e]);// 课程节次范围
    this.teacher = entry[8];
    this.campusId = entry[9];
    this.buildingId = entry[9];
    this.classroomId = entry[9];
    this.capacity = parseInt(entry[11]); // 最大容纳人数
    this.size = parseInt(entry[12]); // 实际选课人数
  }
}

export const DayOfWeek = {
  "星期一": 1,
  "星期二": 2,
  "星期三": 3,
  "星期四": 4,
  "星期五": 5,
  "星期六": 6,
  "星期日": 7,
}

export const ClassOfDay = {
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
