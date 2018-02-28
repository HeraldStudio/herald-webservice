const { Database } = require("sqlite3")

// 对 Database 异步函数进行 async 封装
;['run', 'get', 'all'].map (k => {
  [Database.prototype['_' + k], Database.prototype[k]]
    = [Database.prototype[k], function(sql, param) {
      return new Promise((resolve, reject) => {
        this['_' + k](sql, param || [], (err, res) => {
          err ? reject(err) : resolve(res)
        })
      })
    }]
})

const ORM = function(dbName) {

  // sqlite3 db client
  const db = new Database(`./database/${dbName}.db`)

  // 面向Sqlite的ORM基类
  class ModelBase { 

    // 可以在这里设定数据类型、是否为空、默认值等等。
    // 由于JS目前没有static property，因此暂用static getter代替
    // 被子类复写后，基类中定义的Schema仍然保留，将按照原型链回溯的方式在getFullSchema()中获取。
    static get schema() {
      return {
        // id与name为所有子类都会有的属性（在classroom API的context下）
        // 如有必要，通过学校接口返回的JSON中的杂七杂八的属性也可设置于此
        id : { type: Number, default: 0, primary: true },
        name : { type : String , default: "" }
      }
    }

    // 获取正式、完整的Schema对象
    static getFullSchema() {
      let schema = {}
      let modelChain = []
      // 沿原型链不断向上回溯，逆向构造所有包含schema属性的原型数组
      // 对于静态方法，this指向的就是constructor
      for (let model = this; model.schema; model = Object.getPrototypeOf(model)) {
        modelChain.unshift(model)
      }
      // 沿基类到子类方向添加所有Schema字段
      for (const model of modelChain) {
        for (let [key, config] of Object.entries(model.schema)) {
          // 非Object/Array的config值直接作为默认值，值类型作为类型
          if (typeof config !== "object") {
            config = {
              type: config.constructor,
              default: config
            }
          }
          // 用自定义schema覆写默认schema键值
          schema[key] = Object.assign({
            /* 类型配置 */
            type:     config.type, 
          }, [String, Number, Array].includes(config.type) ? {
            /* 非对象字段约束（将被存入数据库） */ 
            default:  config.type(), // 非对象默认值设为默认构造函数
            nullable: false, // 字段是否为not null。
            unique:   false, // 字段值是否唯一。
            primary:  false, // 字段是否为主键。
            autoInc:  false, // 主键键值是否自增。仅当default值为整数时有效。   
          } : {
            /* 对象相关配置（对象不存入数据库） */
            default:  null, // 对象默认值设为空（代表未加载状态）。
            foreignKey: key + "Id", // 对象对应外键名，默认为key + "Id"。
            // this为最终对象。若要关闭Lazy Load，该项传入null即可。（FIXME: 实现有困难）
            lazyLoad: function() { return config.type.findOne({id: this[schema[key].foreignKey]}) } // 这样写会不会让GC有问题啊……
          }, config)
        }
      }
      return schema
    }

    // 初始化数据库表
    static async initDb() {
      let schema = this.getFullSchema()
      let fieldSQLs = []

      // 由每一个key生成对应的字段SQL语句
      for (const [key, config] of Object.entries(schema)) {
        // 单行SQL语句先用数组表示，初始化为字段名
        let sql = [key]

        // 确定字段的Sqlite类型与默认值
        switch (config.type) {
          case Array:  // Array将以逗号分隔的id字符串存储
          case String: // Sqlite不区分VARCHAR(N)中的N，统一以TEXT处理
            sql.push(`text default ${config.default.toString()}`)
            break;
          case Number: // 类型为Number时，通过default值判断字段是整数还是实数。
            sql.push(`${Number.isInteger(config.default) ? "integer" : "real"} default ${config.default}`)
            break;
          default: // Object不存入数据库中，因此将被忽略掉
            break;
        }

        // 其他约束处理
        sql.concat([
          [!config.nullable, "not null"],
          [config.unique,    "unique"],
          [config.primary,   "primary key"],
          [config.autoInc && Number.isInteger(config.default), "autoincrement"]
        ].filter(v => v[0]).map(v => v[1]))

        // 作为一行一句储存
        fieldSQLs.push(sql.join(' '))
      }

      await db.run(`
        create table if not exists ${this.name} (
          ${fieldSQLs.toString()}
        )`
      )
    }

    static async _find(descriptor, selector, executor) {
      const destFields = Object.entries(selector).filter(e => e[1] === true).map(e => e[0])
      const condFields = Object.keys(descriptor).map(k => `${k} = ?`)
      return await executor.call(db, `
        select ${destFields.length? destFields.toString() : '*'} 
        from ${this.name} 
        ${condFields.length? "where " + condFields.toString() : ""}
      `, Object.values(descriptor))
    }

    static async find(descriptor, selector = {}) {
      return await this._find(descriptor, selector, db.all)
    }

    static async findOne(descriptor, selector = {}) {
      return await this._find(descriptor, selector, db.get)
    }

    // 异步创建一个对象，按需被子类重写（如子类对象创建时需读取数据库）
    static async create(init) {
      // 若未被子类重写，则通过构造函数正常创建一个对象
      return new this(init)
    }

    // 构造Schema相关属性
    // 非数据库字段的类字段/属性可在子类中定义
    constructor(init) {
      const schema = this.constructor.getFullSchema()
      let defaults = {}

      // 将schema重整化为默认对象
      Object.keys(schema).forEach(key => defaults[key] = schema[key].default)
      
      // 利用defaults初始化默认对象，再由外部传入的init对象来进行构造
      Object.assign(this, defaults, init)

      // 根据schema进一步配置对象
      for (const [key, config] of Object.entries(schema)) {
        switch (config.type) {
          case Array:
            if (typeof this[key] === "string") {
              // 若为字符串型数组，则将其还原
              this[key] = this[key].split(',').map(JSON.parse)
            }
          case String:
          case Number:
            break;
          default:
            // 若为对象，则配置其外键属性
            if (config.lazyLoad) { // 配置Lazy Load属性
              // 由于涉及到数据库读取，若触发lazy load, getter会返回Promise
              // 因此，使用getter时需加await保证返回正确的属性
              // 若不需Lazy load，可在init中为该属性先行绑定一个初值
              Object.defineProperties(this, {
                ['_' + key]: {
                  value : this[key],
                  writable : true,
                  enumerable: false // 隐藏属性，防止拷贝
                },
                [key]: {
                  get: () => this['_' + key] || config.lazyLoad.call(this).then(v => this['_' + key] = v),
                  set: v => this['_' + key] = v 
                }
              })
            } else {
              // emmm...这个咋办，不能Lazy Load，又不能在ctor里异步……
            }
        }
      }
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
      const schema = this.constructor.getFullSchema()
      let [keys, values] = [[], []]
      for (const key in schema) {
        // 若当前key为非数组对象，则会被忽略掉
        if (typeof key.type === "object") {
          if (key.type === Array) {
            keys.push(key)
            values.push(this[key].map(JSON.stringify).toString()) //数组采用前缀+字符串保存
          }
        } else {
          keys.push(key)
          values.push(this[key])
        }
      }

      await db.run(`
        insert or replace into ${this.constructor.name} (
          ${keys.toString()}
        ) values (
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
      Object.defineProperty(this, '_' + propName, {
        value : initVal,
        enumerable: false // 防止拷贝
      })
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