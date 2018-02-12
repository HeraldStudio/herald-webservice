const db = require("../../database/helper")("classroom")

// 如有必要，通过学校接口返回的JSON中的杂七杂八的属性也可设置于此
class ModelBase { 
  constructor(obj) {
    this.id   = obj.id
    this.name = obj.name
  }

  // 异步方法创建一个对象，按需被子类重写
  static async create() {
    // 若未被子类重写，则通过构造函数正常创建一个对象
    return new this()
  }

  // 初始化数据库表
  static async initDb() {
    const keys = Object.keys(await this.create())
      .filter(v => v[0] !== '_') // 过滤掉采用Lazy Load机制的（复杂）属性
      .slice(1) // 过滤掉作为主键的id属性，同时name属性保证keys的长度至少为1

    // 
    await db.run(`
      create table if not exists ${this.name} (
        id    integer    primary key,
        ${keys.map(k => `${k} ${typeof k == "number"? "integer" : "text"} not null`).toString()}
      )
    `)
  }

  // 通过名字找到对应记录的ID
  static async findId(name) {
    // 对于静态方法，this指向的就是constructor
    // 即this === this.prototype.constructor -> true
    // 因此this.name即为当前实例化的对象的类名
    const row = await db.get(`select id from ${this.name} where name = ?`, [name])
    return row && row.id
  }

  // 根据id从数据库加载对象
  static async load(id) {
    const row = await db.get(`select * from ${this.name} where id = ?`, [id])
    return new this(row) // this指代见上
  }  

  // 从数据库中加载所有对象
  static async all() {
    const rows = await db.all(`select * from ${this.name}`)
    return rows.map(row => new this(row))
  }

  // 保存当前对象到数据库
  async save() {
    const values = Object.entries(this)
      .filter(v => v[0][0] !== '_') // 过滤掉采用Lazy Load机制的（复杂）属性
      .map(v => v[1] instanceof Array ? v[1].toString() : v[1]) // 数组采用字符串保存

    await db.run(`
      insert or replace into ${this.constructor.name} values (
        ${values.map(v => '?').toString()}
      )`, values
    )
  }

  // 定义一个采用Lazy load机制读取的属性
  // 用于将当前对象的外键ID绑定到对应的对象上
  defineLazyProperty(propName, loadFunc, initVal = undefined) {
    // 若不需Lazy load，可为该属性先行绑定一个初值
    this['_' + propName] = initVal
    Object.defineProperty(this, propName, {
      // 由于涉及到数据库读取，在触发Lazy load时，loadFunc会返回Promise
      // 因此，使用getter时需加await保证返回正确的属性
      get: () => this['_' + propName] || initFunc(),
      set: v => this['_' + propName] = v 
    })
  }
}

class Campus extends ModelBase {
  constructor(obj = {}) {
    super(obj)
  }

  static findName(buildingName) {
    if (buildingName.includes("教")) {
      return "九龙湖"
    } else if (buildingName.includes("纪忠楼")) {
      return "九龙湖纪忠楼"
    } else if (buildingName.includes("无线谷")) {
      return "无线谷"
    } else if (buildingName.includes("无锡分校")) {
      return "无锡分校"
    } else {
      return "四牌楼"
    }
  }
}

class Building extends ModelBase {
  constructor(obj = {}) {
    super(obj)
    // 可从两种位置获取对应的campusId，Classroom下同
    this.campusId = obj.campusId// || obj.campus.id
    // 定义采用Lazy Load机制的Campus属性。若obj.campus存在，则直接进行拷贝。
    this.defineLazyProperty("campus", () => Campus.load(this.campusId), obj.campus)
  }
}

class Classroom extends ModelBase {
  constructor(obj = {}) {
    super(obj)
    this.buildingId          = obj.buildingId// || obj.building.id
    this.classroomTypeIdList = obj.classroomTypeIdList || []
    this.defineLazyProperty("building", () => Building.load(this.buildingId), obj.building)
    this.defineLazyProperty(
      "classroomTypeList", 
      () => Promise.all(this.classroomTypeIdList.map(Id => ClassroomType.load(Id))),
      obj.classroomTypeList && obj.classroomTypeList.map(v => new ClassroomType(v)) // node要是支持optional chaining就好了...
    )
  }
}

class ClassroomType extends ModelBase {
  constructor(obj = {}) {
    super(obj)
  }
}

class ClassRecord extends ModelBase {
  constructor(obj = {}) {
    super(obj)
    Object.assign(this, obj) // 直接拷贝
  }

  // 由于需要读取数据库，因此需要异步创建对象
  static async create(entry = new Array(13).fill("")) {
    return new ClassRecord({
      id          : 0,
      name        : entry[1], // 班级名  
      courseId    : entry[2],
      courseName  : entry[3], // 课程名
      startWeek   : parseInt(entry[4]),
      endWeek     : parseInt(entry[5]),
      dayOfWeek   : DayOfWeek[entry[6]], // 星期几的对应编号
      sequences   : entry[7].split(',').map(e => ClassOfDay[e]), // 课程节次范围
      teacher     : entry[8],
      buildingId  : entry[9] && await Building.findId(entry[9]),
      classroomId : entry[9] && await Classroom.findId(entry[9] + "-" + entry[10]),
      campusId    : entry[9] && await Campus.findId(Campus.findName(entry[9])),
      capacity    : parseInt(entry[11]), // 最大容纳人数
      size        : parseInt(entry[12])  // 实际选课人数
    })
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
  Campus,
  Building,
  Classroom,
  ClassroomType,
  ClassRecord,
  DayOfWeek,
  ClassOfDay
}

;[Campus, Building, Classroom, ClassroomType, ClassRecord].forEach(c => c.initDb())