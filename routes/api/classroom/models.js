const { db, ModelBase } = require("./orm")("classroom")

/**
  ## Campus 数据表结构

  id      integer    校区Id
  name    text       校区名
 */
class Campus extends ModelBase {
  static get schema() {
    return {}
  }

  // 根据建筑名字找到对应校区
  static findName(buildingName) {
    // 虽然这种写法有点诡异……但可读性不算差，就当作一个有趣的语法trick吧~
    // 参见https://stackoverflow.com/questions/2896626/
    switch (true) {
      case /无线谷/.test(buildingName):
        return "无线谷"
      case /无锡分校/.test(buildingName):
        return "无锡分校"
      case /教[一二三四五六七八]/.test(buildingName):
        return "九龙湖"
      case /纪忠楼/.test(buildingName):
        return "九龙湖研究生"
      case /四牌楼/.test(buildingName):
      default:
        return "四牌楼"
    }
  }
}

/**
  ## Building 数据表结构

  id          integer    建筑Id
  name        text       建筑名
  campusId    integer    建筑所属校区Id
 */
class Building extends ModelBase {
  static get schema() {
    return {
      campusId: 0,
      campus: { type: Campus }
    }
  }
}

/**
  ## Classroom 数据表结构

  id                   integer     教室Id
  name                 text        教室名
  buildingId           integer     教室所属建筑Id
  classroomTypeIdList  array       教室类型Id数组
 */
class Classroom extends ModelBase {
  static get schema() {
    return {
      buildingId : 0,
      building: { type: Building },
      classroomTypeIdList: [0],
      classroomTypeList: [{ type: ClassroomType, foreignKey: "classroomTypeIdList" }]
    }
  }

  constructor(init = {}) {
    if (init.classroomTypeList) { // 削去学校接口给的乱七八糟的东西……
      init.classroomTypeList = init.classroomTypeList.map(v => new ClassroomType(v))
    }
    super(init)
  }
}

/**
  ## ClassroomType 数据表结构

  id    integer    教室类型Id
  name  text       教室类型名，可能值有"空调"，"多媒体"，"录播"，"设计"，"电教"，"语音"，"活动"
 */
class ClassroomType extends ModelBase {
  static get schema() {
    return {}
  }
}

/**
  ## ClassRecord 数据表

  数据表的一条记录代表某课程在某一天的开课信息
 */
class ClassRecord extends ModelBase {
  static get schema() {
    return {
      //id            : { type: Number, default: null, primary: true, autoInc: true }, autoInc的实现有点问题
      courseId      : 0,    // 课程Id
      courseName    : "",   // 课程名
      startWeek     : 1,    // 开课周
      endWeek       : 16,   // 结课周
      dayOfWeek     : 0,    // 星期几的对应编号
      startSequence : 0,    // 课程起始节次
      endSequence   : 0,    // 课程结束节次
      teacher       : "",   // 教师名
      year          : { type: Number, default: 0, nullable: true },    // 学生年级
      campusId      : 0,    // 上课校区Id
      buildingId    : 0,    // 上课楼宇Id
      classroomId   : 0,    // 上课教室Id
      termId        : ClassRecord.currentTermId(), // 开课学期Id
      capacity      : 0,    // 最大容纳人数
      size          : 0,    // 实际选课人数
    }
  }

  // 获取当前学期Id。注意！8、9月末调用可能会出错！
  static currentTermId() {
    let today = moment()
    // 由上一年的9月开始，记录月份的偏移量
    let m_offset = today.month() + 4
    // 到了第二年9月即偏移1年
    let y_offset = Math.floor(m_offset / 12)
    // yy为最终表示在学期Id上的2位年份数
    let yy = today.year() - 2001 + y_offset
    // n为当前学期数，分别在偏移1（10月），5（2月）时增1
    let n = 1 + ((m_offset %= 12) && (m_offset < 5 ? 1 : 2))
    return `${yy}-${yy + 1}-${n}`
  }
}

const DayOfWeek = {
  "一": 1,
  "二": 2,
  "三": 3,
  "四": 4,
  "五": 5,
  "六": 6,
  "日": 7,
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
  db,
  Campus,
  Building,
  Classroom,
  ClassroomType,
  ClassRecord,
  DayOfWeek,
  ClassOfDay
}

;[Campus, Building, Classroom, ClassroomType, ClassRecord].forEach(c => c.initDb())
