const { Database } = require("sqlite3")

// 对 Database 异步函数进行 async 封装
// ;['run', 'get', 'all'].map (k => {
//   [Database.prototype['_' + k], Database.prototype[k]]
//     = [Database.prototype[k], function(sql, param) {
//       return new Promise((resolve, reject) => {
//         this['_' + k](sql, param || [], (err, res) => {
//           err ? reject(err) : resolve(res)
//         })
//       })
//     }]
// })

const ORM = function(dbName) {
  const db = new Database(`./database/${dbName}.db`)

  // 面向Sqlite的ORM基类
  class ModelBase { 
    constructor(schema, init) {
      Object.assign(this, {
        // id与name为所有子类都会有的属性（在classroom API的context下）
        // 如有必要，通过学校接口返回的JSON中的杂七杂八的属性也可设置于此
        id   : 0,
        name : ""
      }, schema, init) // schema为默认构造对象，init为外部传入的初始化对象

      // 将所有以字符串形式保存在数据库中的数组还原
      Object.entries(this).forEach(e => {
        if (typeof e[1] === "string" && e[1].substr(0, 7) === "$ARRAY^") {
          this[e[0]] = e[1].slice(7).split(',').map(JSON.parse)
        }
      })
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

      // 由属性数据类型确定字段数据类型
      let dataType = value => {
        if (typeof value === "number") {
          return Number.isInteger(value) ? "integer" : "real"
        } else {
          return "text"
        }
      }
 
      // 对于静态方法，this指向的就是constructor
      // 即this === this.prototype.constructor -> true
      // 因此this.name即为当前实例化的对象的类名
      await db.run(`
        create table if not exists ${this.name} (
          ${entries.map((e, i) => `${e[0]} ${dataType(e[1])} ${i ? "" : "primary key "}not null`).toString()}
        )
      `)
    }

    static _whereStr(descriptor, selector = {}) {
      const destFields = Object.entries(selector).filter(e => e[1] === true).map(e => e[0])
      const condFields = Object.keys(descriptor).map(k => `${k} = ?`)
      return `
        select ${destFields.length? destFields.toString() : '*'} 
        from ${this.name} 
        ${condFields.length? "where" + condFields.toString() : ""}
      `
    }

    static async find(descriptor, selector = {}) {
      return await db.all(this._whereStr(...arguments), Object.values(descriptor))
    }

    static async findOne(descriptor, selector = {}) {
      return await db.get(this._whereStr(...arguments), Object.values(descriptor))
    }

    // todo: findId与load函数改为统一的find接口

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
        .map(v => v[1] instanceof Array ? "$ARRAY^" + v[1].map(JSON.stringify).toString() : v[1]) // 数组采用前缀+字符串保存

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

  return {db, ModelBase}
}

module.exports = ORM