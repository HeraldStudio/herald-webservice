# herald-webservice

小猴偷米 2018 WebService3 后端试验品，使用 Node.js + Koa 构建。

## 进度

1. **中间件部分**

  - [x] redis 缓存数据库
  - [x] 身份认证和隐私加密
  - [x] 网络请求
  - [ ] 分布式代理
  - [ ] 第三方授权

2. **继承自 WebService2**

  - [x] 一卡通（状态 / 当日 / 历史）@rikumi
  - [x] 课表 @rikumi
  - [x] 跑操次数 @rikumi
  - [x] 空教室 @Vigilans-Yea
  - [ ] 跑操详情、跑操预告
  - [ ] 物理实验
  - [ ] 考试安排
  - [ ] 成绩 GPA
  - [ ] SRTP
  - [ ] 人文讲座
  - [ ] 图书馆
  - [ ] 教务通知
  - [ ] 场馆预约
  - [ ] 实时班车

3. **继承自 AppService**

  - [ ] 七牛上传
  - [ ] 一卡通充值
  - [ ] 系统通知发布系统
  - [ ] 广告自助发布审核系统
  - [ ] 完整的 Web 管理后台

4. **新功能提案**

  - [ ] 一卡通自助服务（挂失解挂等）
  - [ ] 网络中心自助服务（开通续费）
  - [ ] 食堂菜品数据库（权益）
  - [ ] 通用抢票、选座系统（研会）
  - [ ] ……（欢迎补充）

## 开发文档（Developer's Preview）

### 介绍

WebService3 是小猴偷米最新的后端架构，基于 Node.js + Koa 进行开发，为模块开发者提供了一系列非常方便的接口，可用于小猴偷米各类查询、服务、管理系统后端的渐进式开发。

WebService3 基于自研的 kf-router，可以根据 js 文件结构自动组织路由，无需独立配置。我们将从 Hello World 开始，介绍 WebService3 的模块开发方式。

### 开始开发

```bash
git clone https://github.com/heraldstudio/herald-webservice
cd herald-webservice
cp config.example.json config.json
npm install
npm run dev
```

### Hello World

```javascript
//: /api/hello.js 或 /api/hello/index.js
exports.route = {
  async get() { // 同步方法可省略 async
    return 'Hello, World!'
  }
}
```

执行 `curl http://localhost:3000/api/hello` 即可看到效果。

### 请求参数

kf-router 提供了 `this` API ，代替 koa 中的 `ctx` ，另外经过 `koa-bodyparser` 处理，可以直接读取 `json`/`urlencoded`/`form` 格式的请求体。WebService3 将 `this.query` 和 `this.request.body` 进行了合并，可通过 `this.params` 统一获取。

注意，本服务端使用较严格的参数解析，`GET` / `DELETE` 请求务必使用 URL 带参数，同样地，`POST` / `PUT` 请求只能解析 `body` 中的参数。

```javascript
//: /api/hello.js 或 /api/hello/index.js
exports.route = {
  async get() {
    let { a, b } = this.params // 相当于 let a = this.params.a, b = this.params.b
    return parseInt(a) + parseInt(b)
  },
  async post() {
    let { c, d } = this.params
    return parseInt(c) + parseInt(d)
  }
  // put, delete 也适用
}
```

执行 `curl http://localhost:3000/api/hello?a=1&b=2` 可得到 `3`；
执行 `curl -X POST http://localhost:3000/api/hello -d c=3 -d d=4` 可得到 `7`。

### 认证 API

WebService3 提供了完整的统一身份认证机制，如果模块需要，可以获取用户的一卡通号码、统一身份认证密码、身份识别码、统一身份认证 Cookie 等信息。

```javascript
exports.route = {
  async get() {
    if (this.user.isLogin) {
      // user 中的任一属性 (除 isLogin) 一旦被访问，当前用户必须是已登录状态，否则将抛出 401

      // 一卡通号、明文密码
      // 为了保证隐私安全，我们将对上线的模块严加审查，严禁对明文密码进行存储、显示、发送给第三方
      let { cardnum, password } = this.user
      // 加密解密函数，需要存储的敏感信息要加密，从数据库中取出要解密
      let { encrypt, decrypt } = this.user
      console.log(decrypt(encrypt(cardnum)) === cardnum) // true

      // 为了保证隐私安全，伪 token 不能用于解密数据，只用于区分用户；cookie 用于抓取统一身份认证有关页面
      let { token, cookie } = this.user

      return `Hello, ${cardnum}!`
    } else {
      return 'Hello, guest!'
    }
  }
}
```

上述模块将对已登录用户和游客显示不同的信息。若不对 `this.user.isLogin` 进行判断，直接取 `this.user` 中的其它属性，系统将默认拒绝游客访问此功能。

### 网络请求

WebService3 框架为 `this` 暴露了 `get` `post` `put` `delete` 四个 API 用于 HTTP 请求，他们在本质上是 `Axios.create()` 所产生的实例的同名方法，用法可参见 [axios 文档](https://github.com/axios/axios)。

```javascript
exports.route = {
  async get() {
    let res = await this.get('https://httpbin.org/get') // 请求上游 API
    if (res.status >= 400) {
      this.throw(res.status) // 抛出与上游相同的错误
      return
    }

    return res.data // axios 将自动对结果执行 JSON.parse；koa 也支持直接返回非字符串类型。
  }
}
```

### 自动缓存

只需在项目的 `config.json` 中进行相应设置，WebService3 就将利用 `redis` 自动为请求进行缓存。

```javascript
{
  ...,
  "cache": {
    "api": {
      "hello": "1y", // /api/hello       缓存1年(按360天计)
      "foo": "10mo", // /api/foo         缓存10个月(每月按30天计)
      "bar": "10d",  // /api/bar         缓存10天
      "foobar": "1h20m6s" // /api/foobar 缓存1小时20分6秒
    }
  }
}
```

### 数据库

WebService3 本身不强制要求模块自身使用任何数据库，对于用户自身的基本信息，最好提议我们写在 **auth 数据库** 中。如果模块确实需要使用数据库，目前推荐使用 `sqlite3` + 参数化查询语句的方式进行开发，可参考框架中间件部分 [auth.js](https://github.com/HeraldStudio/herald-webservice/blob/master/middleware/auth.js) 的数据库用法。

### 代码风格

1. **使用二空格缩进；**
2. 使用 WebStorm / Atom / Sublime Text 等专业工具进行开发；
3. 用 Promise 封装事件机制和回调机制的 API；Promise 封装尽可能精炼；用 `async/await` 代替 `then`；
4. 建议不要分号，以 `[` 或 `(` 开头的行前补分号；
5. **善用解构赋值**、**善用流式编程**可以让代码更简练。
