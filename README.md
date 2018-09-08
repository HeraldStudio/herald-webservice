# WebService3

小猴偷米 2018 WebService3 后端试验品，使用 Node.js + Koa 构建。

## 使用说明

### 部署说明

生产环境下请使用 `npm run start` 代替 `npm run dev`，前者将禁用 `REPL`，启用 `redis` 缓存，并开启 CNN 验证码识别中间件。

生产环境部署前，建议对 redis 进行配置，以满足 WebService3 自动缓存的需求：

```
$ redis-cli
127.0.0.1:6379> config set maxmemory 1GB
127.0.0.1:6379> config set maxmemory-policy allkeys-lru
```

## 接口使用说明

### 接口互解释文档

点击 https://myseu.cn/ws3/api/ 可获得简明的接口文档。

### 返回格式

按照 ReSTful 接口设计的原则，只要请求经由 WebService3 处理，无论请求成功与否，都将遵循下面的返回格式：

1. 除少数接口发生重定向外，返回 HTTP Code 一定为 200（这是为了把 HTTP Code 让给传输过程中的网络错误）；
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

### 用户登录

用户登录时，需要向后端发送登录请求：

```bash
curl -X POST http://myseu.cn/ws3/auth -d cardnum=一卡通号 -d password=统一身份认证密码 platform=平台标识符
```

其中，**平台标识符** 为一个字符串，推荐格式为小写字母和短横线的组合，例如 `android`/`ios`/`react-native` 等。

后端收到登录请求，经过验证后，将返回一个16进制字符串（`token`），作为当前用户的登录凭证。为了隐私安全，此登录凭证的明文形式一旦发出将被后端丢弃，后端保留**用 `token` 加密的密文用户密码**和**用用户密码加密的密文 `token`**，这保证了系统只能在用户提供了密码或 `token` 之一的情况下解密用户数据，我们称之为**交叉加密**。前端需要保存此凭证，并使用此凭证作为 HTTP Header 进行后续请求：

```bash
curl -X GET http://myseu.cn/ws3/api/card -H token:xxxxxxxx
```

> 务必注意，使用 urlencoded 格式 (`-d`) 书写 POST 参数时，键与值之间用 `=` 分隔；书写 HTTP Header (`-H`) 时，键与值之间用 `:` 分隔。这是 HTTP 报文标准规定的。

当然，对于路由处理程序中不需要用户登录的功能，仍可以允许不带 `token` 进行请求；对于需要用户登录的功能，不带 `token` 的用户将收到 `401` 错误；若登录时用户名或密码不正确，也会收到 `401` 错误。

### 过期机制

为了减轻数据库膨胀，超过一定时间未调用接口的用户将会自动过期。该过期时间（天数）在 `config.yml` 中可配置，推荐的时间是 2~3 个月。用户身份过期后，token 的行为将与未登录状态一致，即对于任何需要用户身份的路由均会返回 401。客户端应当随时检测 401 错误，并在出现 401 错误时立即要求用户重新登录。

### 点击量统计

> 传统的 Web 中，服务器在代替前端跳转到目标页面的过程中对用户点击行为进行记录，用于对点击量进行统计，这要求我们在用户的浏览器中直接请求后端路由；如果需要在统计过程中对点击量进行去重，还需要我们使用传统的 Cookie 机制…… 这是我们在前后端分离的大趋势下所不能容忍的。严格的前后端分离模式下，后端不能代替前端做任何决定，包括执行跳转。因此，我们定义了专门用于前端主动上报用户点击行为的接口，并要求前端只有经过上报才能得到目标地址。

用户点击轮播图或活动时，前端需要（与普通接口一样带 token）调用对应的上报接口（轮播图为 `PUT /api/banner`，参数为对应的 `bid`；活动为 `PUT /api/activity`，参数为对应的 `aid`），得到目标地址，并主动展示目标页面，而不是由后端代替前端进行跳转操作。

请只在用户主动点击时调用点击量上报接口，以保证点击量统计的准确性。

## 开发文档

### 介绍

WebService3 是小猴偷米最新的后端架构，基于 Node.js + Koa 进行开发，为模块开发者提供了一系列非常方便的接口，可用于小猴偷米各类查询、服务、管理系统后端的渐进式开发。

WebService3 基于自研的 kf-router，可以根据 js 文件结构自动组织路由，无需独立配置。我们将从 Hello World 开始，介绍 WebService3 的模块开发方式。

### 开始开发

需要安装 Yarn 代替 npm 作为包管理器。

```bash
git clone https://github.com/heraldstudio/herald-webservice
cd herald-webservice
cp sdk/sdk.example.json sdk/sdk.json
yarn dev
```

Windows 用户须先阅读 [https://github.com/nodejs/node-gyp#installation](node-gyp 的安装指南) ，确保安装设置 Python 2.7 以避免编译错误。

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

kf-router 提供了 `this` API ，代替 koa 中的 `ctx` ，另外经过 `koa-bodyparser` 处理，可以直接读取 `json`/`urlencoded`/`form` 格式的请求体。WebService3 将 `this.query` 和 `this.request.body` 进行了合并，可通过 `this.params` 统一获取，也可以直接从函数第一个参数中拿到。

注意，本服务端使用较严格的参数解析，`GET` / `DELETE` 请求务必使用 URL 带参数，同样地，`POST` / `PUT` 请求只能解析 `body` 中的参数。

```javascript
//: /api/hello.js 或 /api/hello/index.js
exports.route = {
  async get() {
    let { a, b } = this.params // 相当于 let a = this.params.a, b = this.params.b
    return parseInt(a) + parseInt(b)
  },
  async post({ c, d }) {
    return parseInt(c) + parseInt(d)
  }
  // put, delete 也适用
}
```

执行 `curl http://localhost:3000/api/hello?a=1&b=2` 可得到 `3`；
执行 `curl -X POST http://localhost:3000/api/hello -d c=3 -d d=4` 可得到 `7`。

### 认证 API

WebService3 提供了完整的统一身份认证机制，如果模块需要，可以获取用户的一卡通号码、统一身份认证密码、身份识别码、统一身份认证 Cookie 等信息。

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

    // 两个用于区分用户的 API，有一定差别：
    // 这里的 token 是不具有隐私性的伪 token，不能用于解密数据，只用于区分用户
    // 同一个实体用户在多处登录时，多个端的伪 token 互不相同，真正用于加解密的 token 也互不相同，因此伪 token 多用于与加解密相关的场合。
    // 而 identity 是区分实体用户的标志，每个实体用户 identity 一定唯一，多用于用户行为分析等。
    let { token, identity } = this.user

    // 原 cookie 由于过期太快已被改为 useAuthCookie() 方法，详见下文「自动 Cookie」

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

### 获取学期

通过 `this.term` 可以得到当前 `config` 中已知的所有学期列表 `this.term.list`，并可以直接获得当前学期 `this.term.current`、上一学期 `this.term.prev`、下一学期 `this.term.next`。

上述「学期」均为对象，包含 `name` 表示学期的编号、`startDate`/`endDate` 时间戳表示学期的开始和结束、`isCurrent`/`isPrev`/`isNext` 表示学期的状态，`isLong` 表示学期的性质。

注意，只要 `config` 配置足够准确，上学期、下学期都是始终存在的，但当前学期可以为空。这就意味着当你需要获取当前学期时，一定要仔细考虑：当处于假期，`this.term.current` 为空时应该如何处理？通常的处理是用刚刚过去的学期或者即将到来的学期作为替代，这时你可以用 `||` 操作符指定一个 `fallback`，例如 `this.term.current || this.term.prev` 等。

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

对于路由处理程序来说，在初始条件下，该 CookieJar 是空的。

与此同时，前述认证 API 提供了 `await this.useAuthCookie()` 方法，可用于获取用户的统一身份认证 Cookie，并自动加入 CookieJar。在路由处理程序中调用 `await this.useAuthCookie()` 方法后，以后的网络请求将对 `.seu.edu.cn` 域名通配符下的地址自动携带用户统一身份认证 Cookie。

`this.useAuthCookie()` 方法与上文提到的除 `isLogin` 外的用户 API 一样，都需要用户处于已登录状态，否则将抛出 `401`。

一个典型的例子就是一卡通模块：

```javascript
async get() {

  // 显式声明需要用户登录，并带上统一身份认证 Cookie
  await this.useAuthCookie()

  // 带着统一身份认证 Cookie 获取一卡通中心 Cookie
  await this.get('http://allinonecard.seu.edu.cn/ecard/dongnanportalHome.action')

  // 带着统一身份认证 Cookie 和一卡通中心 Cookie 抓取一卡通页面
  let res = await this.get('http://allinonecard.seu.edu.cn/accountcardUser.action')

  // Do something with res.data here...
}
```

### 通用返回格式 & 错误处理

在书写路由处理程序时，对于成功返回和失败返回，推荐使用的返回方式分别如下：

1. `return <结果>`：成功返回，状态码为 `200`；
2. `throw <错误码>`：失败返回，会自动将错误码解析为用户可读错误信息的错误码，详见 `middleware/return.js`；
3. `throw <错误信息>`：失败返回，自定义错误信息，状态码为 `400`。

### 缓存 API

通过 `this.userCache()` 和 `this.publicCache()` API，可以对需要缓存的部分进行缓存。

```javascript
async get() {
  // 第一次被调用后，数据将缓存 1 小时 10 分钟
  // 在接下来这段时间内，重复调用将会直接返回缓存的结果，不再重复执行闭包
  return await this.userCache('1h10m', async () => {
    await someTimeConsumingTask()
    return 'Finished'
  })
}
```

注意：在 HTTP 规范中，只有 `GET` 请求是幂等的，这意味着我们通常不应该对 `POST`/`PUT`/`DELETE` 请求进行缓存，也不应该对可能受到其他 `POST`/`PUT`/`DELETE` 请求影响的 `GET` 请求进行缓存。

#### 缓存的 key

缓存的内容默认将按照 `路由+方法+用户身份+参数` 作为 key 进行存储，不同路由、不同方法、不同参数的请求都始终不会共享缓存空间。也可以在此基础上添加新的 key，尤其是当同一路由、同一方法中存在多组需要缓存的数据时，自己添加 key 通常是必须的，否则这些缓存数据将相互混淆。

```javascript
async get() {

  // 通过附加 key 'world' 进行存储，避免本路由中的两个缓存部分相互混淆
  return await this.userCache('world', '1mo', () => { // 缓存 1 个月
    return 'Hello, World!'
  })

  // 附加 key 可以指定多个
  return await this.userCache('ws3', 'another-key', 'yet-another-key', '1d', () => { // 缓存 1 天
    return 'Hello, WebService3!'
  })
}
```

#### 缓存的公有和私有

使用 `this.publicCache()` 进行缓存，表示默认该接口对所有用户返回相同的内容，所有用户可以共享同一个缓存空间，且缓存内容明文存储（对应地，`this.userCache()` 将使用用户 token 加密存储）。所以 **千万不要** 对用户的私人信息使用该 API。

```javascript
async get() {
  return await this.publicCache('1h', () => {
    return 'Cached for everyone!'
  })
}
```

#### 缓存懒抓取模式

通过在时间策略串末尾加上加号 `+`，可设置缓存策略为懒抓取模式，使得缓存在过期后仍能返回给用户，但同时也会触发异步的缓存更新，使用户在足够长时间后的下一次刷新时能获取到最新数据。

```javascript
async get() {
  //  无缓存 => 执行闭包 -> 返回执行结果 -> (若执行成功) 存入缓存
  //  有缓存 && 未过期 => 返回缓存
  //* 有缓存 && 已过期 => 返回缓存 -> 执行闭包 -> (若执行成功) 更新缓存
  return await this.userCache('10s+', () => {
    return 'Caches live longer!'
  })
}
```

为了方便理解，懒抓取策略与非懒抓取的区别仅在于缓存存在但过期的情况。在这种情况下，**非懒抓取策略将优先回源**，回源失败再取缓存，强调数据的时效性；**懒抓取策略将优先取缓存**，然后在后台更新缓存，强调响应速度。

设置了懒抓取模式的闭包中，上下文 `this` 的生命周期将与具体的 HTTP 请求脱离，请务必注意可能导致的副作用。

无论是否采用懒抓取，一旦启用缓存，其时间至少为 5 秒，因此时间串 `+` 将代表 `5s+`。并且，为了减轻服务器压力，**同时多处请求同一个缓存项目只会开启一个抓取任务**，这在共有缓存中表现得尤为明显。

### 数据库

WebService3 本身不强制要求模块自身使用任何数据库，对于用户自身的基本信息，最好提议我们写在 **auth 数据库** 中。如果模块确实需要使用数据库，可以根据自己的习惯选择合适的 Sqlite3 ORM 进行开发。

目前 WebService3 集成了 [sqlongo](https://github.com/HeraldStudio/sqlongo)，可以通过如下方式创建其实例：

```javascript
const db = require('sqlongo')('my_database')
```

### 接口互解释

接口互解释是指，一部分路由处理程序不仅实现自身的功能，还充当向导的角色，介绍相关的其他接口。有了接口互解释的机制，开发者无需提供接口文档供调用者查阅，只需要通过不断调用接口，即可了解所有接口的使用方法。接口互解释在 [GitHub API](https://api.github.com) 中有广泛的应用。

related 中间件提供了接口之间相互解释的 API，以便在不需要接口文档的情况下直接寻找到需要的接口。只要在需要充当向导的接口中尽早调用 `this.related(<相对路径>, { get: <说明文字>, post: <说明文字>, ... })`：

```javascript
//- /api/index.js
this.related('card', {
  get: '{ date?: yyyy-M-d, page? } 一卡通信息及消费流水，不带 date 为当日流水',
  put: '{ password, amount: float, eacc?=1 } 一卡通在线充值'
})
```

如果只有 GET 方法，也可以直接在第二个参数中写介绍。

```javascript
this.related('srtp', 'SRTP 学分及项目查询')
```

为了更加清晰明确，适合 WebService3 的特殊情形，我们所使用的接口互解释与 GitHub 的返回格式不同：

```javascript
GET /api => {
  success: true,
  code:    200,
  result:  '',
  related: [
    {
      url: '/api/card',
      get: '{ date?: yyyy-M-d, page? } 一卡通信息及消费流水，不带 date 为当日流水',
      put: '{ password, amount: float, eacc?=1 } 一卡通在线充值'
    },
    {
      url: '/api/srtp',
      get: 'SRTP 学分及项目查询'
    }
  ]
}
```

### 代码风格

1. **使用二空格缩进；**
2. 使用 WebStorm / Atom / Sublime Text 等专业工具进行开发；
3. 用 Promise 封装事件机制和回调机制的 API；Promise 封装尽可能精炼；用 `async/await` 代替 `then`；
4. 关于分号有两种选择：① 不要分号，以 `[` 或 `(` 开头的行前补分号；② 按照标准，语句全部加分号。请根据自己的习惯选择合适的方案，两种方案不要混用；
5. **善用解构赋值**、**善用流式编程** 可以让代码更简练；
6. 项目代码 100% 面向业务逻辑，**工具函数或工具类请做成轮子再使用或找相关轮子使用，不要随地堆放工具代码**。

### 命名规范

下面列举了本系统可能用到的一些有多种译法的名词。不同译法可能各有好处，但一个系统内部需要有一致性，因此对于每个名词，随机规定其中一种译法作为标准。

此规范适用于系统的 JSON 返回格式。在代码内部不必严格遵照这个规范。

目前已规定的译法有：

1. 课程（结构）用 course（不要 class/lesson）
2. 课程（字符串）用 courseName（不要 course/className/lessonName）
3. 教师（结构）用 teacher（不要 lecturer）
4. 教师（字符串）用 teacherName（不要 teacher/lecturerName）
5. 时间戳（表示年月日级别的）用 Date 结尾；
6. 时间戳（表示年月日时分秒级别的）用 Time 结尾；
7. 节次（课程的第几节）用 period；
8. 开始/结束（时间戳）用 start/end，例如 startTime/endTime；
9. 开始/结束（其他类型）用 begin/end，例如 beginWeek/endWeek；
10. 地点用 location（不要 place）
11. 学分用 credit，成绩用 score，绩点（通称）用 points；绩点（专名）用 GPA；
12. 重修用 makeup，首修用 before makeup。

### 关于分布式爬虫

**目前状态**

1. 借助WebSocket实现，类似于分布代理，用于内网穿透和分流
2. 中间件 `spider-server` 为其服务器部分，已实现功能包含：爬虫身份鉴权、请求打包、响应Promise化、CookieJar打包
3. 与网络请求中间件 `axios` 进行了融合，在使用时透明化，不需要关注请求究竟在本地实现或是在分布爬虫实现
4. 当分布爬虫访问出错时会自动从本地发起请求
5. 可以通过 `config` 中 `spider.enable` 控制是否启用分布式功能
6. 爬虫客户端正在整理即将上线(敬请期待...

**计划功能**

1. 对于是否使用爬虫的临时控制措施
2. 更优雅的爬虫授权方式
3. 给予请求的访问方式过滤

and more？
