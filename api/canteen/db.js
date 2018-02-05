const { Database } = require('sqlite3')
const db = new Database('database/canteen.db')

// 对 Database 异步函数进行 async 封装
;['run', 'get', 'all'].map (k => {
 [db['_' + k], db[k]] = [db[k], (sql, param) => new Promise((resolve, reject) => {
   db['_' + k](sql, param || [], (err, res) => {
     err ? reject(err) : resolve(res)
   })
 })]
})

db.run(`
  create table if not exists canteen (
    cid             integer         primary key   auto_increment, -- 食堂ID
    name            varchar(64)     not null,                     -- 食堂名
    open_time_am    integer         not null,                     -- 上午开张时间，格式 hour * 60 + minute
    close_time_am   integer         not null,                     -- 上午闭店时间，格式 hour * 60 + minute
    open_time_pm    integer         not null,                     -- 下午开张时间，格式 hour * 60 + minute
    close_time_pm   integer         not null,                     -- 下午闭店时间，格式 hour * 60 + minute
    manager         varchar(64)     not null,                     -- 经理姓名
    manager_contact varchar(64)     not null,                     -- 经理电话
    quanyi_contact  varchar(64)     not null,                     -- 权益君电话
    comment         varchar(1024)   not null                      -- 详情介绍
  );
  create table if not exists window (
    wid             integer         primary key   auto_increment, -- 窗口ID
    cid             integer         not null,                     -- 所在食堂ID
    floor           varchar(64)     not null,                     -- 楼层名
    name            varchar(64)     not null,                     -- 窗口名
    pic             varchar(1024)   not null,                     -- 展示图片
    comment         varchar(1024)   not null                      -- 详情介绍
  );
  create table if not exists dish (
    did             integer         primary key   auto_increment, -- 菜品ID
    wid             integer         not null,                     -- 所在窗口ID
    name            varchar(128)    not null,                     -- 菜品名称
    type            varchar(128)    not null,                     -- 菜品大类
    pic             varchar(1024)   not null,                     -- 展示图片
    breakfast       integer         not null,                     -- 是否早餐，早餐1，否则0
    price           integer         not null,                     -- 价格（以0.01元为单位）
    tag             varchar(32)     not null,                     -- 两三个字的简短标签（降价、新品等）
  );
  create table if not exists broadcast (
    bid             integer         primary key   auto_increment, -- 公告ID
    title           varchar(128)    not null,                     -- 公告标题
    content         varchar(1024)   not null,                     -- 公告内容
  );
  create table if not exists admin (
    cardnum         varchar(32)     not null,                     -- 管理员一卡通号
    name            varchar(64)     not null                      -- 管理员姓名
  );
`, [])

const isAdmin = async (cardnum) => {
  return !!await db.get(`select * from admin where cardnum = ?`, [cardnum])
}

module.exports = { db, isAdmin }
