const { AsyncDatabase } = require("sqlongo")

// 因为Sqlongo封装过了，这里再封装一次貌似会出无限递归Bug。。。
// re: sqlongo 1.1.5 取消了上述封装，但这里也不能再封装，会影响 sqlongo
// 建议改为从 sqlongo 里导入 AsyncDatabase。

const ORM = function(dbName) {

  // sqlongo db client
  const db = new AsyncDatabase(`./database/${dbName}.db`)

  // 字段配置类
  class Config {
    constructor(config, key = config.type.name.toLowerCase()) { // 注意参数顺序与后面相比是反的！
      switch (true) { // 对config参数预处理，规范化为对象类型
        case config instanceof Array:
          // 若为Array, 则对config进行重整:
          config[0] = new Config(config[0], key) // 首元素递归重整为Config
          Object.assign(this, config[0], {
            type: Array,
            default: config[0].isForeign() ? null : [],
            element: { type: config[0].type, default: config[0].default }
          })
          return // 直接返回
        case typeof config === "string" || config instanceof String:
        case typeof config === "number" || config instanceof Number:
          // 非Object/Array的config值直接作为默认值，值类型作为类型
          config = { type: config.constructor, default: config }
          break
        default:
          // 若本身就是对象，则不处理
          break
      }

      // 用自定义配置覆写默认配置
      Object.assign(this, {
        /* 类型配置 */
        type:     config.type,
      }, !this.isForeign.call(config) ? {
        /* 非对象字段约束（将被存入数据库） */
        default:  config.type(), // 非对象默认值设为默认构造函数
        nullable: false, // 字段是否为not null。
        unique:   false, // 字段值是否唯一。
        primary:  false, // 字段是否为主键。
        autoInc:  false, // 主键键值是否自增。仅当default值为整数时有效。
      } : {
        /* 对象相关配置（对象不存入数据库） */
        default:  null,         // 对象默认值设为空（代表未加载状态）。
        foreignKey: key + "Id", // 对象对应外键名，默认为key + "Id"。
      }, config)
    }

    // 判断是否为数据表外部对象。可以通过call/apply重用到非Config类对象上。
    isForeign() {
      function isObject() { return this.type !== String && this.type !== Number }
      return isObject.call(this.type === Array? (this[0] || this.element) : this)
    }
  }

  // 面向Sqlite的ORM基类
  class ModelBase {

    // 用以定义数据表的静态对象，需被子类复写。可以在此设定数据类型、是否为空、默认值等等。
    // 被子类复写后，基类中定义的Schema仍然保留，将按照原型链回溯的方式在getFullSchema()中获取。
    // 由于JS目前没有static property，因此暂用static getter代替
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
      if (!this.hasOwnProperty("_fullSchema")) {
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
              schema[key] = new Config(config, key)
          }
        }
        Object.defineProperty(this, "_fullSchema", { value: schema, enumerable: false })
      }
      return this._fullSchema
    }

    // 初始化数据库表
    static async initDb() {
      let schema = this.getFullSchema()
      let fieldSQLs = []

      // 由每一个key生成对应的字段SQL语句
      for (const [key, config] of Object.entries(schema)) {
        // 作为外部数据的Object不存入数据库中，因此将被忽略掉
        if (config.isForeign()) {
          continue
        }
        // 单行SQL语句先用数组表示，初始化为字段名
        let sql = [key]
        // 确定字段的Sqlite类型与默认值
        switch (config.type) {
          case Array:  // Array将以逗号分隔的id字符串存储
          case String: // Sqlite不区分VARCHAR(N)中的N，统一以TEXT处理
            sql.push(`text default '${config.default.toString()}'`)
            break
          case Number: // 类型为Number时，通过default值判断字段是整数还是实数。
            sql.push(`${Number.isInteger(config.default) ? "integer" : "real"} default ${config.default}`)
            break
          default:
            throw (`invalid data field type ${config.type.name}`)
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
      const condFields = Object.keys(descriptor).map(k => `${k} = ifnull(?, ${k})`)
      return await executor.call(db, `
        select ${destFields.length? destFields.toString() : '*'}
        from ${this.name}
        ${condFields.length? "where " + condFields.toString() : ""}
      `, Object.values(descriptor))
    }

    static async find(descriptor, selector = {}) {
      return (await this._find(descriptor, selector, db.all)).map(row => new this(row, {initDefault: false}))
    }

    static async findOne(descriptor, selector = {}) {
      return new this(await this._find(descriptor, selector, db.get), {initDefault: false})
    }

    // 异步创建一个对象，按需被子类重写（如子类对象创建时需读取数据库）
    static async create(init) {
      // 若未被子类重写，则通过构造函数正常创建一个对象
      return new this(init)
    }

    // 构造Schema相关属性。非数据库字段的类字段/属性可在子类中定义。若不需要，子类可不写构造函数。
    constructor(init = {}, option = { initDefault: true }) {
      const schema = this.constructor.getFullSchema()

      if (option.initDefault) {
        // 利用schema的default值与init来构造对象
        Object.keys(schema).forEach(key => this[key] = init[key] || schema[key].default)
      } else {
        Object.assign(this, init)
      }

      // 根据schema进一步配置对象
      for (const [key, config] of Object.entries(schema)) {
        if (config.isForeign()) {
          // 若存储的是对象，则定义一个采用Lazy load机制读取的属性
          const lazyLoad = () => {
            if (config.type !== Array) {
              return config.type.findOne({id: this[config.foreignKey]})
            } else {
              return Promise.all(this[config.foreignKey].map(id => config.element.type.findOne({id})))
            }
          }
          Object.defineProperties(this, {
            ['_' + key]: {
              value: this[key], // 若不需Lazy load，可在init中为该属性先行绑定一个初值
              writable: true,
              enumerable: false // 隐藏属性，防止拷贝
            },
            [key]: {
              get: () => this['_' + key] || lazyLoad().then(v => this['_' + key] = v),
              set: v => this['_' + key] = v
            }
          })
        } else if (config.type === Array && typeof this[key] === "string") {
          // 若为字符串型数组，则将其还原
          this[key] = JSON.parse(this[key])
        }
      }
    }

    // 从数据库中加载所有Lazy Properties
    async load() {
      const schema = this.constructor.getFullSchema()
      for (const [key, config] of Object.entries(schema)) {
        if (config.isForeign()) {
          await this[key] // 加载lazy属性
          // 上一层级属性递归调用
          if (config.type !== Array) {
            await this["_" + key].load() // getter返回的不是引用，所以必须在原对象上调用load
          } else {
            await Promise.all(this["_" + key].map(v => v.load()))
          }
        }
      }
      return this
    }

    // 保存当前对象到数据库
    async save() {
      const schema = this.constructor.getFullSchema()
      let [keys, values] = [[], []]

      for (const [key, config] of Object.entries(schema)) {
        if (config.isForeign()) { // 不保存Object
          continue
        }
        let value = this[key]
        switch (config.type) {
          case Array:
            value = JSON.stringify(value) // 数组采用JSON字符串保存
          case String:
          case Number:
            values.push(value)
            keys.push(key)
            break
          default:
            break
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

    // 规范化转化为JSON的规则
    toJSON() {
      const schema = this.constructor.getFullSchema()
      let jsonObj = {}
      for (const key of Reflect.ownKeys(this)) {
        // 处理getter属性：若已load，则添加进jsonObj中
        if (key[0] !== '_') {
          if (!schema[key].isForeign() || this['_' + key]) {
            jsonObj[key] = this[key]
          }
        }
      }
      return jsonObj
    }

  }

  return {db, Config, ModelBase}
}

module.exports = ORM
