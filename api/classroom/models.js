const db = require("../../database/helper")("classroom")

// 面向Sqlite的ORM基类
class ModelBase { 
  constructor(schema, init) {
    Object.assign(this, {
      // id与name为所有子类都会有的属性（在classroom API的context下）
      // 如有必要，通过学校接口返回的JSON中的杂七杂八的属性也可设置于此
      id   : 0,
      name : ""
    }, schema, init) // schema为默认构造对象，init为外部传入的用以初始化对象
  }

  // 异步创建一个对象，按需被子类重写（如子类对象创建时需读取数据库）
  static async create() {
    // 若未被子类重写，则通过构造函数正常创建一个对象
    return new this()
  }

  // 初始化数据库表
  static async initDb() {
    const entries = Object.entries(await this.create()) // 通过this.create()构造一个默认对象作为schema
      .filter(e => e[0][0] !== '_') // 过滤掉采用Lazy Load机制的（复杂）属性
      .slice(1) // 过滤掉作为主键的id属性，同时name属性保证keys的长度至少为1

    // 对于静态方法，this指向的就是constructor
    // 即this === this.prototype.constructor -> true
    // 因此this.name即为当前实例化的对象的类名
    await db.run(`
      create table if not exists ${this.name} (
        id    integer    primary key,
        ${entries.map(e => `${e[0]} ${typeof e[1] === "number"? "integer" : "text"} not null`).toString()}
      )
    `)
  }

  // 通过名字找到对应记录的ID
  static async findId(name) {
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

  // 将类对象转化为正规形式，方便作为json返回
  async formalize() {
    let lazyKeys = Object.keys(this).filter(k => k[0] === '_')
    for (k of lazyKeys) {
      this[k.slice(1)] = await this[k.slice(1)] // 加载lazy属性
      delete this[k] // 删除'_'开头的辅助属性
      await this[k.slice(1)].formalize() // 上一层级属性递归调用
    }
    return this
  }

  // 定义一个采用Lazy load机制读取的属性
  // 用于将当前对象的外键ID绑定到对应的对象上
  defineLazyProperty(propName, loadFunc, initVal = undefined) {
    // 若不需Lazy load，可为该属性先行绑定一个初值
    this['_' + propName] = initVal
    Object.defineProperty(this, propName, {
      // 由于涉及到数据库读取，若触发lazy load, getter会返回Promise
      // 因此，使用getter时需加await保证返回正确的属性
      get: () => this['_' + propName] || loadFunc().then(v => this['_' + propName] = v),
      set: v => this['_' + propName] = v 
    })
  }
}

/**
  ## Campus 数据表结构

  id      integer    校区Id
  name    text       校区名 
 */
class Campus extends ModelBase {
  constructor(init) {
    super({}, init)
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
  constructor(init) {
    super({
      campusId: 0
    }, init)
    // 定义采用Lazy Load机制的Campus属性。若init.campus存在，则直接进行拷贝，下同
    this.defineLazyProperty("campus", () => Campus.load(this.campusId), init.campus)
  }
}

/**
  ## Classroom 数据表结构

  id            integer    教室Id
  name          text       教室名 
  buildingId    integer    教室所属建筑Id
 */
class Classroom extends ModelBase {
  constructor(init) {
    super({
      buildingId : 0,
      classroomTypeIdList: []
    }, init)
    this.defineLazyProperty("building", () => Building.load(this.buildingId), init.building)
    this.defineLazyProperty(
      "classroomTypeList", 
      () => Promise.all(this.classroomTypeIdList.map(Id => ClassroomType.load(Id))),
      init.classroomTypeList && init.classroomTypeList.map(v => new ClassroomType(v)) // node要是支持optional chaining就好了...
    )
    // TODO: 在基类中加入数组类型解析
    // 将从数据库中读出的用于保存的字符串转为数组
    if (typeof this.classroomTypeIdList == "string") {
      this.classroomTypeIdList = this.classroomTypeIdList.split(',').map(Number)
    }
  }
}

/**
  ## Classroom 数据表结构

  id    integer    教室类型Id
  name  text       教室类型名，可能值有"空调"，"多媒体"，"录播"，"设计"，"电教"，"语音"，"活动"
 */
class ClassroomType extends ModelBase {
  constructor(init) {
    super(init)
  }
}

/**
  ## ClassRecord 数据表

  数据表的一条记录代表某课程在某一天的开课信息
 */
class ClassRecord extends ModelBase {
  constructor(init) {
    super({ // 属性全部写明并初始化，保证数据表的字段能正确创建
      courseId      : 0,    // 课程Id
      courseName    : "",   // 课程名
      startWeek     : 1,    // 开课周
      endWeek       : 16,   // 结课周
      dayOfWeek     : 0,    // 星期几的对应编号
      startSequence : 0,    // 课程起始节次
      endSequence   : 0,    // 课程结束节次
      teacher       : "",   // 教师名
      year          : 0,    // 学生年级
      campusId      : 0,    // 上课校区Id
      buildingId    : 0,    // 上课楼宇Id
      classroomId   : 0,    // 上课教室Id
      termId        : ClassRecord.currentTermId(), // 开课学期Id
      capacity      : 0,    // 最大容纳人数
      size          : 0,    // 实际选课人数
    }, init) // init一般不会有以上全部属性
  }

  // 获取当前学期Id。注意！8、9月末调用可能会出错！
  static currentTermId() {
    let today = new Date()
    // 由上一年的9月开始，记录月份的偏移量
    let m_offset = today.getMonth() + 4
    // 到了第二年9月即偏移1年
    let y_offset = Math.floor(m_offset / 12)
    // yy为最终表示在学期Id上的2位年份数
    let yy = today.getFullYear() - 2001 + y_offset
    // n为当前学期数，分别在偏移1（10月），5（2月）时增1
    let n = 1 + ((m_offset %= 12) && (m_offset < 5 ? 1 : 2))
    return `${yy}-${yy + 1}-${n}`
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