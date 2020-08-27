"use strict";

function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance"); }

function _iterableToArrayLimit(arr, i) { if (!(Symbol.iterator in Object(arr) || Object.prototype.toString.call(arr) === "[object Arguments]")) { return; } var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

/* eslint no-unused-vars:off, require-atomic-updates:off */
var oracledb = require('oracledb');

var cheerio = require('cheerio'); // 每节课的开始时间 (时 * 60 + 分)
// 注：本科生和研究生的时间表完全一样。


var courseStartTime = '8:00|8:50|9:50|10:40|11:30|14:00|14:50|15:50|16:40|17:30|18:30|19:20|20:10'.split('|').map(function (k) {
  return k.split(':').map(Number).reduce(function (a, b) {
    return a * 60 + b;
  }, 0);
});
exports.route = {
  /**
  * @api {GET} /api/curriculum 课表查询
  * @apiGroup other
  * @apiParam term 学期号（不填则为教务处设定的当前学期）
  *
  * ## 返回格式举例：
  * {
  *   term: { name, maxWeek, startDate?, endDate?, isCurrent?, isNext?, isPrev? } // 查不到开学日期时只有前两个
  *   user: { cardnum, schoolnum, name, collegeId, collegeName, majorId, majorName }
  *   curriculum: [
  *     { // 浮动课程只有前五个属性
  *       courseName, teacherName, credit,
  *       beginWeek, endWeek,       // 1 ~ 16
  *       // 非浮动课程兼有后面这些属性
  *       dayOfWeek?,               // 为了数据直观以及前端绘图方便，1-7 分别表示周一到周日
  *       flip?,                    // even 双周, odd 单周, none 全周
  *       location?,
  *       beginPeriod?, endPeriod?, // 1 ~ 13
  *       events: [
  *         { week, startTime, endTime } // 课程每一周上课的具体时间戳
  *       ]
  *     }
  *   ]
  * }
  *
  * ## 关于丁家桥课表的周次问题：
  * 在之前 webserv2 的使用中，我们发现部分院系课表的周次与常理相悖，这种现象尤以丁家桥校区为甚。
  * 经过调查，该现象是因为丁家桥校区多数院系不设短学期，短学期和秋季学期合并为一个大学期，
  * 而教务处系统不支持这种设定，致使排课老师对此进行主观处理导致的。
  * 由于不同院系排课老师理解的区别，所做的主观处理也不尽相同，具体表现有以下三种：
  *
  * 1. 短学期课表有 1-4 周，长学期课表有 1-16 周
  * 这种课表属于正常课表，不需要做任何处理即可兼容；
  *
  * 2. 短学期课表为空，长学期课表有 1-20 周
  * 这类课表出现时，老师通常让学生直接查询长学期课表，将短学期的开学日期当做长学期的开学日期。
  * 对于这类课表，我们需要在系统中将长学期开学日期向前推4周，而且短学期为空时应当主动转化为长学期查询；
  *
  * 3. 短学期课表有 1-4 周，长学期课表有 5-20 周
  * 这类课表出现时，老师通常让学生查询短学期课表作为前四周，长学期课表作为后 16 周。
  * 对于这类课表，我们需要在系统中将长学期开学日期向前推4周。
  **/
  get: function get(_ref) {
    var _this = this;

    var term, currentTerm, _this$user, name, cardnum, schoolnum, curriculum, myResult, result, _myResult, headers, res, $, endYear, period, re, option, data;

    return regeneratorRuntime.async(function get$(_context4) {
      while (1) {
        switch (_context4.prev = _context4.next) {
          case 0:
            term = _ref.term;
            currentTerm = (this.term.currentTerm || this.term.nextTerm).name; // 若为查询未来学期，可能是在选课过程中，需要减少缓存时间
            // return await this.userCache('1d+', async () => {

            _this$user = this.user, name = _this$user.name, cardnum = _this$user.cardnum, schoolnum = _this$user.schoolnum;
            curriculum = []; // 新选课系统-目前使用18级本科生数据进行测试

            if (!(/^21318/.test(cardnum) || /^[0-9A-Z]{3}18/.test(schoolnum) || /^21319/.test(cardnum) || /^[0-9A-Z]{3}19/.test(schoolnum))) {
              _context4.next = 19;
              break;
            }

            // 处理 term
            if (!term) {
              term = currentTerm;
            }

            term = this.term.list.find(function (t) {
              return t.name === term;
            });

            if (term.name.endsWith('1')) {
              term.maxWeek = 4;
            }

            if (term.name.endsWith('2') || term.name.endsWith('3')) {
              term.maxWeek = 16;
            }

            _context4.next = 11;
            return regeneratorRuntime.awrap(this.userCache('1d+', function _callee() {
              var result;
              return regeneratorRuntime.async(function _callee$(_context) {
                while (1) {
                  switch (_context.prev = _context.next) {
                    case 0:
                      _context.next = 2;
                      return regeneratorRuntime.awrap(_this.db.execute("\n        select T_PK_SJDDB.SKZC,SKXQ,KSJC,JSJC,JASMC,KCM,XM\n        from (\n          select *\n          from t_xk_xkxs\n          where xh=:cardnum and xnxqdm =:termName\n        )a\n        left join t_rw_jsb\n        on a.jxbid = t_rw_jsb.jxbid\n        left join t_pk_sjddb\n        on a.jxbid = T_PK_SJDDB.JXBID\n        left join T_JAS_JBXX\n        on t_pk_sjddb.jasdm = t_jas_jbxx.jasdm\n        left join t_kc_kcb\n        on a.kch = t_kc_kcb.kch\n        left join T_JZG_JBXX\n        on T_RW_JSB.JSH = T_JZG_JBXX.ZGH\n        ", {
                        cardnum: cardnum,
                        termName: term.name
                      }));

                    case 2:
                      result = _context.sent;
                      result.rows.map(function (Element) {
                        var _Element = _slicedToArray(Element, 7),
                            SKZC = _Element[0],
                            SKXQ = _Element[1],
                            KSJC = _Element[2],
                            JSJC = _Element[3],
                            JASMC = _Element[4],
                            KCM = _Element[5],
                            XM = _Element[6];

                        var course = {
                          courseName: KCM,
                          teacherName: XM,
                          beginWeek: SKZC ? SKZC.indexOf('1') + 1 : undefined,
                          endWeek: SKZC ? SKZC.lastIndexOf('1') + 1 : undefined,
                          dayOfWeek: parseInt(SKXQ) ? parseInt(SKXQ) : undefined,
                          flip: SKZC ? SKZC.startsWith('1010') ? 'odd' : SKZC.startsWith('0101') ? 'even' : 'none' : 'none',
                          beginPeriod: parseInt(KSJC) ? parseInt(KSJC) : undefined,
                          endPeriod: parseInt(JSJC) ? parseInt(JSJC) : undefined,
                          location: JASMC,
                          credit: '学分未知'
                        }; // 存在部分课程没有上课周次的情况，会导致整个课表崩掉

                        if (course.endWeek) curriculum.push(course);
                      });
                      return _context.abrupt("return", curriculum);

                    case 5:
                    case "end":
                      return _context.stop();
                  }
                }
              });
            }));

          case 11:
            curriculum = _context4.sent;
            _context4.next = 14;
            return regeneratorRuntime.awrap(this.db.execute("\n        SELECT COURSENAME, TEACHERNAME, BEGINWEEK, ENDWEEK, DAYOFWEEK, FLIP, BEGINPERIOD, ENDPERIOD, LOCATION, WID\n        FROM H_MY_COURSE\n        WHERE OWNER = :cardnum and SEMESTER = :termName\n        ", {
              cardnum: cardnum,
              termName: term.name
            }));

          case 14:
            myResult = _context4.sent;
            myResult.rows.map(function (Element) {
              var _Element2 = _slicedToArray(Element, 10),
                  courseName = _Element2[0],
                  teacherName = _Element2[1],
                  beginWeek = _Element2[2],
                  endWeek = _Element2[3],
                  dayOfWeek = _Element2[4],
                  flip = _Element2[5],
                  beginPeriod = _Element2[6],
                  endPeriod = _Element2[7],
                  location = _Element2[8],
                  _id = _Element2[9];

              var course = {
                _id: _id,
                courseName: courseName,
                teacherName: teacherName,
                beginWeek: beginWeek,
                endWeek: endWeek,
                dayOfWeek: dayOfWeek,
                flip: flip,
                beginPeriod: beginPeriod,
                endPeriod: endPeriod,
                location: location,
                credit: '学分未知'
              };
              curriculum.push(course);
            }); // 前端要求，除去值为null的字段

            curriculum.forEach(function (Element) {
              for (var e in Element) {
                if (Element[e] === null) delete Element[e];
              }
            });
            _context4.next = 58;
            break;

          case 19:
            if (/^22/.test(cardnum)) {
              _context4.next = 32;
              break;
            }

            term = term.split('-').map(function (Element) {
              if (term.split('-').indexOf(Element) <= 1) {
                Element = Element.slice(2, 4);
              }

              return Element;
            }).join('-');
            _context4.next = 23;
            return regeneratorRuntime.awrap(this.userCache('1d+', function _callee2() {
              var _loop;

              return regeneratorRuntime.async(function _callee2$(_context3) {
                while (1) {
                  switch (_context3.prev = _context3.next) {
                    case 0:
                      _loop = function _loop() {
                        var isStudent, res, sidebarDict, sidebarList, appendClasses;
                        return regeneratorRuntime.async(function _loop$(_context2) {
                          while (1) {
                            switch (_context2.prev = _context2.next) {
                              case 0:
                                // 老师的号码是1开头的九位数
                                // 考虑到学号是八位数的情况
                                isStudent = !/^1\d{8}$/.exec(cardnum); // 抓取课表页面

                                _context2.next = 3;
                                return regeneratorRuntime.awrap(isStudent ? _this.post('http://xk.urp.seu.edu.cn/jw_service/service/stuCurriculum.action', {
                                  queryStudentId: cardnum,
                                  queryAcademicYear: term || undefined
                                }) : _this.post( // 老师课表
                                'http://xk.urp.seu.edu.cn/jw_service/service/teacurriculum.action', {
                                  query_teacherId: cardnum,
                                  query_xnxq: term || undefined
                                }));

                              case 3:
                                res = _context2.sent;

                                if (term) {
                                  _context2.next = 13;
                                  break;
                                }

                                _context2.prev = 5;
                                // 从课表页面抓取学期号
                                // console.log(res.data.toString())
                                term = /<font class="Context_title">[\s\S]*?(\d{2}-\d{2}-\d)[\s\S]*?<\/font>/im.exec(res.data.toString())[1];
                                _context2.next = 13;
                                break;

                              case 9:
                                _context2.prev = 9;
                                _context2.t0 = _context2["catch"](5);
                                console.log(_context2.t0);
                                throw '解析失败';

                              case 13:
                                term = term.split('-').map(function (Element) {
                                  if (term.split('-').indexOf(Element) <= 1) {
                                    Element = '20' + Element;
                                  }

                                  return Element;
                                }).join('-'); // 用 term 字符串从 term 中间件中拿到学期对象，这里 term 从字符串类型变成了 Object

                                term = _this.term.list.find(function (k) {
                                  return k.name === term;
                                }) || {
                                  name: term
                                }; // 初始化侧边栏和课表解析结果

                                sidebarDict = {}, sidebarList = []; // 解析侧边栏，先搜索侧边栏所在的 table

                                res.data.toString().match(/class="tableline">([\s\S]*?)<\/table/img)[0] // 取 table 中所有行
                                .match(/<tr height="3[48]">[\s\S]*?<\/tr\s*>/img) // 老师课表是height=38
                                // 去掉表头表尾
                                .slice(1, -1).map(function (k) {
                                  var courseData = k.match(/<td[^>]*>(.*?)<\/td\s*>/img);

                                  if (isStudent) {
                                    // 取每行中所有五个单元格，去掉第一格，分别抽取文本并赋给课程名、教师名、学分、周次
                                    courseData = courseData.slice(1);
                                  } else {
                                    // 各个单元格是: (0)序号，(1)课程名称，(2)被注释掉的老师名称，(3)老师名称，(4)课程编号，(5)课程类型*，(6)考核*，(7)学分，(8)学时，(9)周次
                                    // * 5 和 6 标题如此，但是内容事实上是 (5)考核 (6)课程类型。
                                    // 这里我们取和学生课表相同的部分
                                    courseData = [courseData[1], courseData[3], courseData[7], courseData[9]];
                                  }

                                  var _courseData$map = courseData.map(function (td) {
                                    return cheerio.load(td).text().trim();
                                  }),
                                      _courseData$map2 = _slicedToArray(_courseData$map, 4),
                                      courseName = _courseData$map2[0],
                                      teacherName = _courseData$map2[1],
                                      credit = _courseData$map2[2],
                                      weeks = _courseData$map2[3];

                                  credit = parseFloat(credit || 0);

                                  var _map = (weeks.match(/\d+/g) || []).map(function (k) {
                                    return parseInt(k);
                                  }),
                                      _map2 = _slicedToArray(_map, 2),
                                      beginWeek = _map2[0],
                                      endWeek = _map2[1];

                                  if (!isStudent) {
                                    // 只留下名字
                                    teacherName = teacherName.replace(/^\d+系 /, '');
                                  } // 表格中有空行，忽略空行，将非空行的值加入哈希表进行索引
                                  // 这里做一个修正，因为侧栏的起止星期和课表详情中的起止星期可能用不同的表示，
                                  // 比如侧栏中有 10-10 无线网络及安全、11-11 无线网络及安全、12-12 无线网络及安全，
                                  // 但课表详情中有的课写着 10-12 周。所以这里需要把侧栏中的每一周拆出来，


                                  if (courseName || weeks) {
                                    // 这个 sidebarObj 会同时用在两个地方：
                                    // 一方面用在 sidebarList 里面，用于记录侧栏里面哪些课没有用到；
                                    // 另一方面用在 sidebarDict 里面，做一套索引，用于记录每一门课每一周的课的授课老师和学分
                                    // 这两边一定要指向同一个对象，不要深拷贝，为了在后面操作 sidebarDict 的时候可以同时设置到 sidebarList 里面的课的 used 字段
                                    var sidebarObj = {
                                      courseName: courseName,
                                      teacherName: teacherName,
                                      credit: credit,
                                      beginWeek: beginWeek,
                                      endWeek: endWeek
                                    };
                                    sidebarList.push(sidebarObj);

                                    for (var i = beginWeek; i <= endWeek; i++) {
                                      if (!sidebarDict[courseName.trim()]) {
                                        sidebarDict[courseName.trim()] = [];
                                      } // 由于侧栏的信息不够完整，这里只能假设某一周某一课固定由某个老师来上
                                      // 如果某一周某一课有多个老师和学分信息，暂且用后来的覆盖先来的，没有办法区分。


                                      sidebarDict[courseName.trim()][i] = sidebarObj;
                                    }
                                  }
                                }); // 方法复用，传入某个单元格的 html 内容（td 标签可有可无），将单元格中课程进行解析并放入对应星期的课程列表中

                                appendClasses = function appendClasses(cellContent, dayOfWeek) {
                                  // 流式编程高能警告
                                  curriculum = curriculum.concat( // 在单元格内容中搜索连续的三行，使得这三行中的中间一行是 [X-X周]X-X节 的格式，对于所有搜索结果
                                  // 老师课表(可能会)多出来一个空行
                                  (cellContent.match(/[^<>]*<br>(?:<br>)?\[\d+-\d+周]\d+-\d+节<br>[^<>]*/img) || []).map(function (k) {
                                    // 在搜索结果中分别匹配课程名、起止周次、起止节数、单双周、上课地点
                                    var _$exec$slice = /([^<>]*)<br>(?:<br>)?\[(\d+)-(\d+)周](\d+)-(\d+)节<br>(\([单双]\))?([^<>]*)/.exec(k).slice(1),
                                        _$exec$slice2 = _slicedToArray(_$exec$slice, 7),
                                        courseName = _$exec$slice2[0],
                                        beginWeek = _$exec$slice2[1],
                                        endWeek = _$exec$slice2[2],
                                        beginPeriod = _$exec$slice2[3],
                                        endPeriod = _$exec$slice2[4],
                                        flip = _$exec$slice2[5],
                                        location = _$exec$slice2[6]; // 对于起止周次、起止节数，转化成整数


                                    var _map3 = [beginWeek, endWeek, beginPeriod, endPeriod].map(function (k) {
                                      return parseInt(k);
                                    });

                                    var _map4 = _slicedToArray(_map3, 4);

                                    beginWeek = _map4[0];
                                    endWeek = _map4[1];
                                    beginPeriod = _map4[2];
                                    endPeriod = _map4[3];
                                    // 对于单双周，转换成标准键值
                                    flip = {
                                      '(单)': 'odd',
                                      '(双)': 'even'
                                    }[flip] || 'none'; // 根据课程名和起止周次，拼接索引键，在侧栏表中查找对应的课程信息
                                    // let teacherName = '', credit = ''
                                    // 对于这个课的每一周，到侧栏去找对应的授课老师和学分等信息

                                    var ret = [];
                                    var courseNameTrim = courseName.trim();

                                    for (var week = beginWeek; week <= endWeek; week++) {
                                      // 遇到单双周，跳过本次循环，这里是一个小 trick
                                      // - 如果课程单周，当前双周，左 0 右 0，条件成立
                                      // - 如果课程双周，当前单周，左 1 右 1，条件成立
                                      // - 如果课程不论单双周，右边 -1，条件始终不成立
                                      if (week % 2 === ['odd', 'even'].indexOf(flip)) {
                                        continue;
                                      }

                                      var sidebarObj = sidebarDict[courseNameTrim] && sidebarDict[courseNameTrim][week] || {};
                                      sidebarObj.used = true;
                                      var _sidebarObj$teacherNa = sidebarObj.teacherName,
                                          teacherName = _sidebarObj$teacherNa === void 0 ? '' : _sidebarObj$teacherNa,
                                          _sidebarObj$credit = sidebarObj.credit,
                                          credit = _sidebarObj$credit === void 0 ? 0 : _sidebarObj$credit; // 取到上一周这节课的信息，如果跟这一周这节课信息一致，则拓展上一周的

                                      var previous = ret.length && ret.slice(-1)[0];

                                      if (previous && teacherName === previous.teacherName && credit === previous.credit) {
                                        previous.endWeek = week; // 这里不能 ++，因为单双周可能跨两周
                                      } else {
                                        // 否则，新增一个课，这个课暂时假设从本周开始，到本周结束
                                        // 如果下一周还是同一个老师同一个学分的课，循环到下一周的时候会给 endWeek 自增的
                                        ret.push({
                                          courseName: courseName,
                                          teacherName: teacherName,
                                          credit: credit,
                                          location: location,
                                          beginWeek: week,
                                          endWeek: week,
                                          dayOfWeek: dayOfWeek,
                                          beginPeriod: beginPeriod,
                                          endPeriod: endPeriod,
                                          flip: flip
                                        });
                                      }
                                    } // 返回课程名，教师名，学分，上课地点，起止周次，起止节数，单双周，交给 concat 拼接给对应星期的课程列表


                                    return ret;
                                  }).reduce(function (a, b) {
                                    return a.concat(b);
                                  }, []));
                                }; // 对于第二个大表格


                                res.data.toString().match(/class="tableline"\s*>([\s\S]*?)<\/table/img)[1] // 取出每一行最末尾的五个单元格，排除第一行
                                .match(/(<td[^>]*>.*?<\/td>[^<]*){5}<\/tr/img).slice(1).map(function (k) {
                                  // 第 0 格交给周 1，以此类推
                                  k.match(/<td[^>]*>.*?<\/td>/img).map(function (k, i) {
                                    return appendClasses(k, i + 1);
                                  });
                                }); // 取周六大单元格的内容，交给周六

                                appendClasses(/>周六<\/td>[^<]*<td[^>]*>([\s\S]*?)<\/td>/img.exec(res.data)[1], 6); // 取周日大单元格的内容，交给周日

                                appendClasses(/>周日<\/td>[^<]*<td[^>]*>([\s\S]*?)<\/td>/img.exec(res.data)[1], 7); // 将侧栏中没有用过的剩余课程（浮动课程）放到 other 字段里

                                curriculum = curriculum.concat(Object.values(sidebarList).filter(function (k) {
                                  return !k.used;
                                })); // 确定最大周数

                                term.maxWeek = curriculum.map(function (k) {
                                  return k.endWeek;
                                }).reduce(function (a, b) {
                                  return a > b ? a : b;
                                }, 0); // 针对一些辅修课程不显示学期

                                if (!term.maxWeek) {
                                  term.maxWeek = term.isLong ? 16 : 4;
                                } // 为了兼容丁家桥表示法，本科生和教师碰到秋季学期超过 16 周的课表，将开学日期前推四周


                                if (term.maxWeek > 16 && !/^22/.test(cardnum) && /-2$/.test(term.name)) {
                                  term.startDate -= moment.duration(4, 'weeks');
                                }

                              case 25:
                              case "end":
                                return _context2.stop();
                            }
                          }
                        }, null, null, [[5, 9]]);
                      };

                    case 1:
                      _context3.next = 3;
                      return regeneratorRuntime.awrap(_loop());

                    case 3:
                      if ( // 为了兼容丁家桥表示法
                      !curriculum.length && // 如果没有课程
                      /-1$/.test(term.name) && ( // 而且当前查询的是短学期
                      term = term.name.replace(/-1$/, '-2')) // 则改为查询秋季学期，重新执行
                      ) {
                        _context3.next = 1;
                        break;
                      }

                    case 4:
                      return _context3.abrupt("return", {
                        term: term,
                        curriculum: curriculum
                      });

                    case 5:
                    case "end":
                      return _context3.stop();
                  }
                }
              });
            }));

          case 23:
            result = _context4.sent;
            term = result.term;
            curriculum = result.curriculum; // 添加自定义课程

            _context4.next = 28;
            return regeneratorRuntime.awrap(this.db.execute("\nSELECT COURSENAME, TEACHERNAME, BEGINWEEK, ENDWEEK, DAYOFWEEK, FLIP, BEGINPERIOD, ENDPERIOD, LOCATION, WID\nFROM H_MY_COURSE\nWHERE OWNER = :cardnum and SEMESTER = :termName\n", {
              cardnum: cardnum,
              termName: term.name
            }));

          case 28:
            _myResult = _context4.sent;

            _myResult.rows.map(function (Element) {
              var _Element3 = _slicedToArray(Element, 10),
                  courseName = _Element3[0],
                  teacherName = _Element3[1],
                  beginWeek = _Element3[2],
                  endWeek = _Element3[3],
                  dayOfWeek = _Element3[4],
                  flip = _Element3[5],
                  beginPeriod = _Element3[6],
                  endPeriod = _Element3[7],
                  location = _Element3[8],
                  id = _Element3[9];

              var course = {
                courseName: courseName,
                teacherName: teacherName,
                beginWeek: beginWeek,
                endWeek: endWeek,
                dayOfWeek: dayOfWeek,
                flip: flip,
                beginPeriod: beginPeriod,
                endPeriod: endPeriod,
                location: location,
                credit: '学分未知',
                _id: id
              };
              curriculum.push(course);
            });

            _context4.next = 58;
            break;

          case 32:
            _context4.next = 34;
            return regeneratorRuntime.awrap(this.useAuthCookie());

          case 34:
            headers = {
              'Referer': 'http://121.248.63.139/nstudent/index.aspx'
            }; // 获取课程列表页
            // 这里不能使用二维课表页面，因为二维课表页面在同一单元格有多节课程时，课程之间不换行，很难解析

            _context4.next = 37;
            return regeneratorRuntime.awrap(this.get('http://121.248.63.139/nstudent/pygl/pyxkcx.aspx', {
              headers: headers
            }));

          case 37:
            res = _context4.sent;
            $ = cheerio.load(res.data);

            if (!term) {
              _context4.next = 54;
              break;
            }

            endYear = term.split('-')[1];
            period = term.split('-')[2]; //let [beginYear, endYear, period] = term.split('-')

            period = ['短学期', '秋学期', '春学期'][period - 1];
            re = RegExp("".concat(endYear).concat(period, "$"));
            option = $('#txtxq option').toArray().map(function (k) {
              return $(k);
            }).find(function (k) {
              return re.test(k.text());
            });

            if (option) {
              _context4.next = 48;
              break;
            }

            // 用 term 字符串从 term 中间件中拿到学期对象，这里 term 从字符串类型变成了 Object
            term = this.term.list.find(function (k) {
              return k.name === term;
            }) || {
              name: term
            };
            return _context4.abrupt("return", {
              term: term,
              curriculum: []
            });

          case 48:
            data = {
              '__EVENTTARGET': 'txtxq',
              '__EVENTARGUMENT': '',
              'txtxq': option.attr('value')
            };
            $('input[name="__VIEWSTATE"]').toArray().map(function (k) {
              return $(k);
            }).map(function (k) {
              data[k.attr('name')] = k.attr('value');
            });
            _context4.next = 52;
            return regeneratorRuntime.awrap(this.post('http://121.248.63.139/nstudent/pygl/pyxkcx.aspx', data));

          case 52:
            res = _context4.sent;
            $ = cheerio.load(res.data);

          case 54:
            // 将学期号转换为本科生风格的学期号（但只有 -2 和 -3），统一格式
            term = $('option[selected]').text().trim().replace(/\d{2}(\d{2})/g, '$1').replace('秋学期', '-2').replace('春学期', '-3'); // 用 term 字符串从 term 中间件中拿到学期对象，这里 term 从字符串类型变成了 Object

            term = this.term.list.find(function (k) {
              return k.name === term;
            }) || {
              name: term
            }; // 研究生无短学期，秋季学期提前两周开始

            if (/-2$/.test(term.name)) {
              term.startDate -= moment.duration(2, 'weeks');
            } // 课表信息，与本科生格式完全一致


            curriculum = $('table.GridBackColor tr').toArray().slice(1, -1).map(function (k) {
              return $(k);
            }).map(function (tr) {
              var _tr$children$toArray$ = tr.children('td').toArray().map(function (k) {
                return $(k).text();
              }),
                  _tr$children$toArray$2 = _slicedToArray(_tr$children$toArray$, 10),
                  className = _tr$children$toArray$2[0],
                  location = _tr$children$toArray$2[1],
                  department = _tr$children$toArray$2[2],
                  id = _tr$children$toArray$2[3],
                  courseName = _tr$children$toArray$2[4],
                  teacherName = _tr$children$toArray$2[5],
                  period = _tr$children$toArray$2[6],
                  hours = _tr$children$toArray$2[7],
                  credit = _tr$children$toArray$2[8],
                  degree = _tr$children$toArray$2[9];

              credit = parseFloat(credit || 0);

              var _period$split = period.split(/;\s*/),
                  _period$split2 = _slicedToArray(_period$split, 2),
                  weekPeriod = _period$split2[0],
                  dayPeriod = _period$split2[1];

              var _weekPeriod$match$map = weekPeriod.match(/\d+/g).map(Number),
                  _weekPeriod$match$map2 = _slicedToArray(_weekPeriod$match$map, 2),
                  beginWeek = _weekPeriod$match$map2[0],
                  endWeek = _weekPeriod$match$map2[1];

              var days = dayPeriod.split(/\s+/);
              return days.map(function (day) {
                var _day$split = day.split(/-/),
                    _day$split2 = _slicedToArray(_day$split, 2),
                    dayOfWeek = _day$split2[0],
                    periods = _day$split2[1];

                dayOfWeek = '一二三四五六日'.indexOf(dayOfWeek.split('').slice(-1)[0]) + 1;
                periods = periods.split(/,/g).map(function (p) {
                  return '上下晚'.indexOf(p[0]) * 5 + Number(/\d+/.exec(p)[0]);
                });
                var begins = periods.filter(function (k, i, a) {
                  return i === 0 || a[i] !== a[i - 1] + 1;
                });
                var ends = periods.filter(function (k, i, a) {
                  return i === a.length - 1 || a[i] !== a[i + 1] - 1;
                });
                return begins.map(function (k, i) {
                  return {
                    courseName: className,
                    teacherName: teacherName,
                    credit: credit,
                    location: location,
                    beginWeek: beginWeek,
                    endWeek: endWeek,
                    dayOfWeek: dayOfWeek,
                    beginPeriod: k,
                    endPeriod: ends[i],
                    flip: 'none'
                  };
                });
              }).reduce(function (a, b) {
                return a.concat(b);
              }, []);
            }).reduce(function (a, b) {
              return a.concat(b);
            }, []);

          case 58:
            // if 本科生 / 研究生
            // 给有上课时间的课程添加上课具体周次、每周上课的具体起止时间戳
            curriculum.map(function (k) {
              var beginWeek = k.beginWeek,
                  endWeek = k.endWeek,
                  dayOfWeek = k.dayOfWeek,
                  beginPeriod = k.beginPeriod,
                  endPeriod = k.endPeriod,
                  flip = k.flip;

              if (dayOfWeek) {
                k.events = Array(endWeek - beginWeek + 1).fill().map(function (_, i) {
                  return i + beginWeek;
                }).filter(function (i) {
                  return i % 2 !== ['odd', 'even'].indexOf(flip);
                }).map(function (week) {
                  return {
                    week: week,
                    startTime: term.startDate + ((week * 7 + dayOfWeek - 8) * 1440 + courseStartTime[beginPeriod - 1]) * 60000,
                    endTime: term.startDate + ((week * 7 + dayOfWeek - 8) * 1440 + courseStartTime[endPeriod - 1] + 45) * 60000
                  };
                });
              }
            }); // 应对jwc完全没有时间的情况

            curriculum.map(function (k) {
              k.beginWeek = k.beginWeek ? k.beginWeek : 1;
              k.endWeek = k.endWeek ? k.endWeek : term.maxWeek;
            });
            this.logMsg = "".concat(name, " (").concat(cardnum, ") - \u67E5\u8BE2\u8BFE\u7A0B\u8868");
            return _context4.abrupt("return", {
              term: term,
              curriculum: curriculum
            });

          case 62:
          case "end":
            return _context4.stop();
        }
      }
    }, null, this);
  },

  /**
  * @api {POST} /api/curriculum 自定义课程
  * @apiGroup other
  * @apiParam courseName  课程名      
  * @apiParam teacherName 老师名
  * @apiParam beginWeek   开始周次  
  * @apiParam endWeek     结束周次`
  * @apiParam dayOfWeek   星期几      // 为了数据直观以及前端绘图方便，1-7 分别表示周一到周日
  * @apiParam flip        单双周      // even 双周, odd 单周, none 全周
  * @apiParam beginPeriod 开始节次
  * @apiParam endPeriod   结束节次
  * @apiParam location    地点
  **/
  post: function post(_ref2) {
    var courseName, teacherName, beginWeek, endWeek, dayOfWeek, flip, beginPeriod, endPeriod, location, cardnum, sql, binds, options, result;
    return regeneratorRuntime.async(function post$(_context5) {
      while (1) {
        switch (_context5.prev = _context5.next) {
          case 0:
            courseName = _ref2.courseName, teacherName = _ref2.teacherName, beginWeek = _ref2.beginWeek, endWeek = _ref2.endWeek, dayOfWeek = _ref2.dayOfWeek, flip = _ref2.flip, beginPeriod = _ref2.beginPeriod, endPeriod = _ref2.endPeriod, location = _ref2.location;
            cardnum = this.user.cardnum;

            if (courseName) {
              _context5.next = 4;
              break;
            }

            throw '课程名未定义';

          case 4:
            if (!(!beginWeek || !endWeek)) {
              _context5.next = 6;
              break;
            }

            throw '周次未定义';

          case 6:
            if (!flip) {
              flip = 'none';
            }

            sql = "INSERT INTO H_MY_COURSE VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9, sys_guid(), :10, '".concat(this.term.currentTerm.name, "')");
            binds = [[courseName, teacherName, beginWeek, endWeek, dayOfWeek, flip, beginPeriod, endPeriod, location, cardnum]];
            options = {
              autoCommit: true,
              bindDefs: [{
                type: oracledb.STRING,
                maxSize: 100
              }, {
                type: oracledb.STRING,
                maxSize: 90
              }, {
                type: oracledb.NUMBER
              }, {
                type: oracledb.NUMBER
              }, {
                type: oracledb.NUMBER
              }, {
                type: oracledb.STRING,
                maxSize: 10
              }, {
                type: oracledb.NUMBER
              }, {
                type: oracledb.NUMBER
              }, {
                type: oracledb.STRING,
                maxSize: 200
              }, {
                type: oracledb.STRING,
                maxSize: 20
              }]
            };
            _context5.next = 12;
            return regeneratorRuntime.awrap(this.db.executeMany(sql, binds, options));

          case 12:
            result = _context5.sent;

            if (!(result.rowsAffected > 0)) {
              _context5.next = 17;
              break;
            }

            return _context5.abrupt("return", '自定义课程成功');

          case 17:
            throw '自定义课程失败';

          case 18:
          case "end":
            return _context5.stop();
        }
      }
    }, null, this);
  },

  /**
  * @api {DELETE} /api/curriculum 删除自定义课程
  * @apiGroup other
  * @apiParam _id
  */
  "delete": function _delete(_ref3) {
    var _id, record, result;

    return regeneratorRuntime.async(function _delete$(_context6) {
      while (1) {
        switch (_context6.prev = _context6.next) {
          case 0:
            _id = _ref3._id;
            _context6.next = 3;
            return regeneratorRuntime.awrap(this.db.execute("\n    select * from H_MY_COURSE\n    where wid= :id\n  ", {
              id: _id
            }));

          case 3:
            record = _context6.sent;
            record = record.rows[0];

            if (record) {
              _context6.next = 7;
              break;
            }

            throw '事务不存在';

          case 7:
            _context6.next = 9;
            return regeneratorRuntime.awrap(this.db.execute("\n    DELETE from H_MY_COURSE\n    WHERE WID =:id\n  ", {
              id: _id
            }));

          case 9:
            result = _context6.sent;

            if (!(result.rowsAffected > 0)) {
              _context6.next = 14;
              break;
            }

            return _context6.abrupt("return", '删除成功');

          case 14:
            throw '删除失败';

          case 15:
          case "end":
            return _context6.stop();
        }
      }
    }, null, this);
  }
};