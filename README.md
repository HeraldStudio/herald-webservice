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

  - [x] 一卡通（状态 / 当日 / 历史） @rikumi
  - [x] 课表 @rikumi
  - [x] 跑操次数 @rikumi
  - [x] 空教室 @Vigilans-Yea
  - [ ] 跑操详情、跑操预告
  - [ ] 物理实验
  - [ ] 考试安排
  - [x] 成绩 GPA @rikumi
  - [x] SRTP @imfinethanks
  - [ ] 人文讲座
  - [ ] 图书馆
  - [ ] 教务通知
  - [ ] 场馆预约
  - [ ] 实时班车

3. **继承自 AppService**

  - [ ] 七牛上传
  - [x] 一卡通充值 @rikumi
  - [ ] 系统通知发布系统
  - [ ] 广告自助发布审核系统
  - [ ] 完整的 Web 管理后台

4. **新功能提案**

  - [ ] 一卡通自助服务（挂失解挂等）
  - [x] 网络中心自助服务（开通续费）
  - [ ] 食堂菜品数据库（权益）施工中
  - [ ] 通用抢票、选座系统（研会）
  - [ ] ……（欢迎补充）

## 开发文档

### 介绍

WebService3 是小猴偷米最新的后端架构，基于 Node.js + Koa 进行开发，为模块开发者提供了一系列非常方便的接口，可用于小猴偷米各类查询、服务、管理系统后端的渐进式开发。

WebService3 基于自研的 kf-router，可以根据 js 文件结构自动组织路由，无需独立配置。我们将从 Hello World 开始，介绍 WebService3 的模块开发方式。

### 开始开发

```bash
git clone https://github.com/heraldstudio/herald-webservice
cd herald-webservice
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

#### 登录和 Token 格式

用户登录时，需要向后端发送登录请求：

```bash
curl -X POST http://localhost:3000/auth -d cardnum=一卡通号 -d password=统一身份认证密码
```

后端收到登录请求，经过验证后，将返回一个64字节的字符串（`token`），作为当前用户的登录凭证。为了隐私安全，此登录凭证一旦发出将被后端丢弃。前端需要保存此凭证，并使用此凭证作为 HTTP Header 进行后续请求：

```bash
curl -X GET http://localhost:3000/api/card -H token:xxxxxxxx
```

> 务必注意，使用 urlencoded 格式 (`-d`) 书写 POST 参数时，键与值之间用 `=` 分隔；书写 HTTP Header (`-H`) 时，键与值之间用 `:` 分隔。这是 HTTP 报文标准规定的。

当然，对于路由处理程序中不需要用户登录的功能，仍可以允许不带 `token` 进行请求；对于需要用户登录的功能，不带 `token` 的用户将收到 `401` 错误；若登录时用户名或密码不正确，也会收到 `401` 错误。

#### 要求登录

那么，如何在书写路由处理程序时表明当前功能是否需要登录呢？一般的设定是，只要程序读取了 `this.user` 中的任一属性 (除 `isLogin`)，当前用户必须是已登录状态。这意味着，通常情况下，你完全不需要显式地「设定」一个路由处理程序是否需要登录，程序会自动根据是否使用了用户信息进行推断。

下面的例子展示了一个需要登录的功能，并且介绍了 `this.user` 中提供的八种用户信息 API：

```javascript
exports.route = {
  async get() {
    // 一卡通号、明文密码、姓名、学号
    // 为了保证隐私安全，我们将对上线的模块严加审查，严禁对明文密码进行存储、显示、发送给第三方
    let { cardnum, password, name, schoolnum } = this.user

    // 加密解密函数，需要存储的敏感信息要加密，从数据库中取出要解密
    let { encrypt, decrypt } = this.user
    console.log(decrypt(encrypt(cardnum)) === cardnum) // true

    // 为了保证隐私安全，伪 token 不能用于解密数据，只用于区分用户；cookie 用于抓取统一身份认证有关页面
    let { token, cookie } = this.user

    return `Hello, ${cardnum}!`
  }
}
```

#### 对游客和用户进行区分

当然，如果你需要同时对游客和已登录用户开放同一个功能，并且仍然需要对已登录用户读取用户信息，可以使用下面的范式。在这个范式中，我们对 `this.user.isLogin` 做了先行判断，只有当用户已登录时，才读取用户身份信息，避免对游客调用用户身份 API 导致 `401` 错误：

```javascript
exports.route = {
  async get() {
    if (this.user.isLogin) {
      return `Hello, ${this.user.cardnum}!`
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
    return res.data // axios 将自动对结果执行 JSON.parse；koa 也支持直接返回非字符串类型，将自动执行 JSON.stringify。
  }
}
```

考虑到学校网站的历史原因和爬虫自身的需求，我们对这套 axios API 的默认配置进行了一系列变更：

1. 考虑到学校网站中 GBK 编码仍占有很大比例，我们对网络请求的返回结果进行了自动编码检测，并自动转换为 Node.js 原生支持的 UTF-8 编码，开发者无须再关心编码转换问题；
2. 由于前后端不分离的环境下大多使用 `x-www-form-urlencoded` 格式进行 Body 编码，该编码方案已经被默认使用。若要临时采用 JSON 编码，可以手动执行 `JSON.stringify` 序列化；
3. 这套网络请求 API 另外还自带了 CookieJar，可自动记录并使用当前会话内的 Cookie，详见下文「自动Cookie」；
4. 我们的中间件程序被设计为能够自动识别路由处理程序中直接抛出的网络请求异常，并对这些异常做一些预设的解读和转换，例如把 `401` 和 `403` 原样返回给用户，把超时转换为 `408`，其余错误转换为 `503`，在下面「通用返回格式 & 错误处理」中，这些错误码都将变成用户可读的、完整准确的错误提示。

### 自动 Cookie

在上文提到的网络请求 API 中，为了爬虫处理方便，我们利用 `CookieJar` 机制，对 Cookie 的获取和使用做了封装，在先后多次请求时，后面的请求将自动带上当前会话中已经得到的 Cookie，并遵循同源策略。这就意味着，在大多数情况下，你无需手动管理 Cookie。

与此同时，前述认证 API 不仅提供了 `this.user.cookie`，另外也提供了更加方便的方法来使用用户统一身份认证 Cookie。只要显式调用 `this.useAuthCookie()` 方法，就会声明当前功能需要用户登录，并在以后的网络请求中，对 `.seu.edu.cn` 域名通配符下的地址自动携带用户统一身份认证 Cookie。

我们要求路由处理程序编写者显式调用该方法，是为了在自动携带 Cookie 的同时，仍能允许路由处理程序明确表达是否需要用户登录。因此，`this.useAuthCookie()` 方法与上文提到的除 `isLogin` 外的用户 API 一样，都需要用户处于已登录状态，否则将抛出 `401`。

一个典型的例子就是一卡通模块：

```javascript
async get() {

  // 显式声明需要用户登录，并带上统一身份认证 Cookie
  this.useAuthCookie()

  // 带着统一身份认证 Cookie 获取一卡通中心 Cookie
  await this.get('http://allinonecard.seu.edu.cn/ecard/dongnanportalHome.action')

  // 带着统一身份认证 Cookie 和一卡通中心 Cookie 抓取一卡通页面
  let res = await this.get('http://allinonecard.seu.edu.cn/accountcardUser.action')

  // Do something with res.data here...
}
```

### 通用返回格式 & 错误处理

按照 ReSTful 接口设计的原则，只要请求经由 WebService3 处理，无论请求成功与否，都将遵循下面的返回格式：

1. 返回 HTTP Code 一定为 200（这是为了把 HTTP Code 让给传输过程中的网络错误）；
2. 所有成功返回格式均为：

    ```javascript
      {
        "success": true,
        "code": 200,
        "result": <路由处理程序返回的结果>
      }
    ```
3. 所有失败返回格式均为：

    ```javascript
      {
        "success": false,
        "code": <不小于400的整数>,
        "reason": <用户可读的友好化错误信息>
      }
    ```

在书写路由处理程序时，对于成功返回和失败返回，推荐使用的返回方式分别如下：

1. `return <结果>`：成功返回，状态码为 `200`；
2. `throw <错误码>`：失败返回，会自动将错误码解析为用户可读错误信息的错误码，详见 `middleware/return.js`；
3. `throw <错误信息>`：失败返回，自定义错误信息，状态码为 `400`。

### 自动缓存

只需在项目的 `config.json` 中进行相应设置，WebService3 就将利用 `redis` 自动为请求进行缓存。

```javascript
{
  ...,
  "cache": {
    "api": {
      "hello": "1y", // /api/hello          缓存1年(按360天计)
      "foo": "10mo", // /api/foo            缓存10个月(每月按30天计)
      "bar": "10d",  // /api/bar            缓存10天
      "foobar": {
        "get": "1h20m6s" // GET /api/foobar 缓存1小时20分6秒
      }
    }
  }
}
```

注意：在 HTTP 规范中，只有 `GET` 请求是幂等的，这意味着我们通常不应该对 `POST`/`PUT`/`DELETE` 请求进行缓存，也不应该对可能受到其他 `POST`/`PUT`/`DELETE` 请求影响的 `GET` 请求进行缓存。

在缓存配置文件中，可以通过类似上述 `/api/foobar` 接口的做法来对适用于缓存的请求方法进行限制。

### 数据库

WebService3 本身不强制要求模块自身使用任何数据库，对于用户自身的基本信息，最好提议我们写在 **auth 数据库** 中。如果模块确实需要使用数据库，目前推荐使用 `sqlite3` + 参数化查询语句的方式进行开发，可参考框架中间件部分 [auth.js](https://github.com/HeraldStudio/herald-webservice/blob/master/middleware/auth.js) 的数据库用法。

### 代码风格

1. **使用二空格缩进；**
2. 使用 WebStorm / Atom / Sublime Text 等专业工具进行开发；
3. 用 Promise 封装事件机制和回调机制的 API；Promise 封装尽可能精炼；用 `async/await` 代替 `then`；
4. 建议不要分号，以 `[` 或 `(` 开头的行前补分号；
5. **善用解构赋值**、**善用流式编程**可以让代码更简练。
