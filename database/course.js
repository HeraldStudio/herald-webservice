/**
 * 课程统计数据库（本科生 only）
 * 根据成绩查询的结果，统计全校开课信息，记录课程上课的院系年级，以备课表预测等高级功能使用。
 */

const db = require('sqlongo')('course')

// 各课程信息
db.course = {
  cid:         'text primary key', // 课程编号
  courseName:  'text not null',    // 课程名
  courseType:  'text not null',    // '' | '经济管理类' | '人文社科类' | '自然科学与技术科学类'
  credit:      'real not null',    // 学分
  avgScore:    'real not null',    // 平均分，0 表示无法解析为数字
  sampleCount: 'int not null',     // 样本容量，每次查询为一个样本，由于成绩查询具有缓存，而且去重需要加个表，暂不进行去重
  updateTime:  'int not null',     // 最后更新时间
}

// 每天清理两个月不更新的课
setInterval(() => {
  let criteria = { updateTime: { $lt: +moment().subtract(2, 'months') }}
  db.course.remove(criteria)
  db.courseSemester.remove(criteria)
}, +moment.duration(1, 'day'))

// 各课程的上课学期统计
// 只计算首修
// 注：由于转专业相关信息不足，可能存在转专业同学在转后专业产生了转前专业课程的情况，需要在查询时过滤样本容量低的数据
db.courseSemester = {
  cid:        'text not null',  // 课程编号
  major:      'text not null',  // 上课专业号（学号前三位）
  grade:      'int not null',   // 上课学年（1 大一 / 2 大二 / 3 大三 / 4 大四）
  semester:   'int not null',   // 上课学期（1 短学期 / 2 秋学期 / 3 春学期）
  updateTime: 'int not null'    // 最后更新时间
}

// 后三个字段一起加索引，通用性强一些
db`create index if not exists courseSemesterIndex on courseSemester(major, grade, semester)`
module.exports = db