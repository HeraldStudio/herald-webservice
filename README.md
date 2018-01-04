# HeraldWS3

小猴偷米 2018 WebService3 后端试验品，使用 Node.js + Koa 构建。

## 部署

使用以下的命令来配置环境。Windows 用户可能希望将 `/` 替换成 `\` ，并将 `cp -v` 改成 `copy`；而 Ubuntu 用户可能会需要安装一个更新版本的 Node。目前，可以运行在 Node v8.7.0 上。默认的监听端口是 3000。

```bash
cd path/to/HeraldWS3
cp -v config.example.json config.json
npm install
node app.js
```

## 开发

本项目非常欢迎 Issue 和 Pull Request，较有把握的更改也可以直接推送。

### 开发参考

需要参考 [kf-router](https://github.com/heraldstudio/kf-router) 的相关文档。对实验性项目 kf-router 有意见或建议的同样也可以 Issue 或 PR。

### 开发进度

1. **继承自 HeraldAuth**

  - [ ] 缓存数据库、隐私加密、前置身份认证

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

4. **新功能提案**

  - [ ] 一卡通自助服务（挂失解挂等）
  - [ ] 网络中心自助服务（开通续费）
  - [ ] 通用抢票、选座系统
  - [ ] ……（欢迎补充）

### 格式规范

- `.editorconfig`中规定了基本的代码格式规范，主流编辑器均会自动读取；
- 如果使用 WebStorm 等自带 Lint 易于发现错误的开发环境，建议使用省略分号的写法，遇行首括号在括号之前原地加分号；如果使用 Atom 等编辑器，也可以根据个人习惯带分号，以免遇行首括号出错；
- 不建议使用 `Promise::then()` API，请尽量使用异步 IIFE `(async () => { await... })()` 代替；
- 善用 `await`，不影响后续操作的 IO 过程尽量直接异步调用，不要干等。


