## 空教室查询模块

## Introduction

### APIs

| Method |                 Uri                 |   Description    |
| :----: | :---------------------------------: | :--------------: |
|  GET   | [/api/classroom/spare](index.js#L6) |    空教室统一查询接口     |
|  GET   | [/api/classroom/course](course.js)  |      蹭课查询接口      |
|  GET   |   [/api/classroom/](index.js#L11)   |   校区/楼宇数据查询接口    |
|  POST  |   [/api/classroom/](index.js#L34)   |  通过爬虫完整更新一次数据库   |
|  PUT   |  [/api/classroom/](index.js#L129)   | 通过JSON Body更新数据库 |

## Business Logic

### 数据采集：

WebService通过基于类的[ORM](orm.js)模拟了教室、课表等数据的对象结构，存放在[models.js](models.js)中。

通过POST API，可以爬取各处的课表信息，整理后存入数据库中。  

通过PUT API，可以通过Body中附带的JSON数据对数据库进行手动更新。

通过GET API，可以查询到校区/建筑/教室的所有条目，方便前端组织下拉框数据。

### 空教室统一查询接口：

- 当查询楼宇为教一~教八时，调用校方接口进行查询；
- 当查询其他楼宇时，通过WebService中自己组织的课表数据进行筛选查询：
  1. 通过查询条件筛选出所有符合条件的课程条目；
  2. 筛去所有有课的教室，返回剩余的空教室数据。

同时，该实现保证两种查询方法最终返回的JSON格式一致，即内部的查询逻辑对客户端是透明的。

### 蹭课查询接口

待更新。

## Future To-dos

- [ ] 采集丁家桥、四牌楼建院的本科生课表
- [x] 对一些格式较特殊的课程条目进行处理（如一星期有若干天有课）
- [ ] 优化分页查询功能（目前每次换页都需重新遍历数据库生成查询结果）
- [ ] 请求中未选择校区时，同时调用学校与WebService接口进行查询
- [ ] 添加教室的类型数据（空调/多媒体, etc）（这个感觉很难知道啊）
- [x] 添加学期的查询支持
- [x] 添加校区/楼宇名称与ID的查询API
- [ ] 统一校区/楼宇名称的输出风格
- [ ] 添加管理员检查


## Collaborators

- 09016319 叶志浩 [@Vigilans-Yea](https://github.com/Vigilans-Yea)