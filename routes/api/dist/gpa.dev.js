"use strict";

function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance"); }

function _iterableToArrayLimit(arr, i) { if (!(Symbol.iterator in Object(arr) || Object.prototype.toString.call(arr) === "[object Arguments]")) { return; } var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

var cheerio = require('cheerio');

var oracledb = require('oracledb'); //const db = require('../../database/course')
// 折合百分制成绩（本科生用）(国内)
// 数据库数据对应等级 201 优; 202 良; 203 中; 204 及格; 205 不及格；207 缺考；206 缓考；208 作弊；209 免修；
// 210 通过；211 出国交流认定；301 作弊；302 违纪；303 严重违纪；


var calculateEquivalentScore = function calculateEquivalentScore(score) {
  if (/201/.test(score)) {
    score = 95;
  } else if (/202/.test(score)) {
    score = 85;
  } else if (/203/.test(score)) {
    score = 75;
  } else if (/204/.test(score)) {
    score = 60;
  } else if (/211|205|206|207|208|301|302|303/.test(score)) {
    score = 0;
  } else if (/210/.test(score)) {
    score = 60;
  }

  return parseFloat(score) || 0;
}; // 折合百分制成绩（本科生用）(国外)

/*const calculateEquivalentForeignScore = score => {
  if (/201/.test(score)) {
    score = 97
  } else if (/202/.test(score)) {
    score = 87
  } else if (/203/.test(score)) {
    score = 77
  } else if (/211/.test(score)) {
    score = 0
  } else if (/210/.test(score)) {
    score = 60
  }
  return parseFloat(score) || 0
}*/

/**
 * @apiDefine gpa gpa相关接口
 */


exports.route = {
  /**
  * @api {GET} /api/gpa 查询绩点信息
  * @apiGroup gpa 
  */

  /**
  * GET /api/gpa
  * 成绩查询
  * 注意本科生和研究生返回结果格式略有不同
  **/
  get: function get() {
    var _this = this;

    var _this$user, name, cardnum, detail, myexamData, courseHasPassed, achievedCredits, courseHighestPassed, courseTypes, gpa, calculationTime, gpaBeforeMakeup, year, _detail, _myexamData, _courseHasPassed, _achievedCredits, _courseHighestPassed, _gpa, _calculationTime, _gpaBeforeMakeup, _year, headers, res, $, _detail2, score, degree, optional, total, required, credits;

    return regeneratorRuntime.async(function get$(_context3) {
      while (1) {
        switch (_context3.prev = _context3.next) {
          case 0:
            _this$user = this.user, name = _this$user.name, cardnum = _this$user.cardnum; // 本科生

            if (!/^21/.test(cardnum)) {
              _context3.next = 54;
              break;
            }

            if (!(/^21318/.test(cardnum) || /^21319/.test(cardnum))) {
              _context3.next = 30;
              break;
            }

            _context3.next = 5;
            return regeneratorRuntime.awrap(this.userCache('1h+', function _callee() {
              var rawData, rawDetail, indexList, detail;
              return regeneratorRuntime.async(function _callee$(_context) {
                while (1) {
                  switch (_context.prev = _context.next) {
                    case 0:
                      _context.next = 2;
                      return regeneratorRuntime.awrap(_this.db.execute("\n          select XNXQDM,a.WID,KCM,KCXZDM,XF,ZCJ,CXCKDM\n          from (\n            select *\n            from T_CJ_LRCJ\n            where xh =:cardnum\n          )a\n          left join T_XK_XKXS\n          on a.xh = T_XK_XKXS.xh and a.kch = T_XK_XKXS.kch\n        ", {
                        cardnum: cardnum
                      }));

                    case 2:
                      rawData = _context.sent;

                      /*let rawDetail = rawData.rows.map(row => {
                        let semesterName = row[0].split('-')
                        let cxckMap = new Map([['01','首修'],['02','重修'],['03','及格重修'],['04','补考']])
                        let kcxzMap = new Map([['01','必修'],['02','任选'],['03','限选']])
                        semesterName = `${semesterName[0].slice(2)}-${semesterName[1].slice(2)}-${semesterName[2]}`
                        return {
                          semester: semesterName,
                          cid: row[1],
                          courseName: row[2],
                          courseType: kcxzMap.get(row[3]),
                          credit: row[4],
                          score: calculateEquivalentScore(row[5]),
                          isPassed: (row[5] >= 60 && row[5] <= 100) || (row[5] > 200 && row[5] <= 210),  //右边的条件是针对老系统的等级成绩的
                          isFirstPassed: false,
                          isHighestPassed: false,
                          scoreType: cxckMap.get(row[6])
                        }
                      })*/
                      rawDetail = [];
                      rawData.rows.map(function (row) {
                        var _row = _slicedToArray(row, 7),
                            semester = _row[0],
                            cid = _row[1],
                            courseName = _row[2],
                            courseType = _row[3],
                            credit = _row[4],
                            score = _row[5],
                            scoreType = _row[6];

                        var semesterName = semester ? semester.split('-') : '其他';
                        var cxckMap = new Map([['01', '首修'], ['02', '重修'], ['03', '及格重修'], ['04', '补考']]);
                        var kcxzMap = new Map([['01', '必修'], ['02', '任选'], ['03', '限选']]);

                        if (semesterName !== '其他') {
                          semesterName = "".concat(semesterName[0].slice(2), "-").concat(semesterName[1].slice(2), "-").concat(semesterName[2]);
                        }

                        var gpa = {
                          semester: semesterName,
                          cid: cid,
                          courseNumber: cid,
                          courseName: courseName,
                          courseType: kcxzMap.get(courseType),
                          credit: credit,
                          score: calculateEquivalentScore(score),
                          isPassed: score >= 60 && score <= 100 || score > 200 && score <= 210,
                          //右边的条件是针对老系统的等级成绩的
                          isFirstPassed: false,
                          isHighestPassed: false,
                          scoreType: cxckMap.get(scoreType)
                        };
                        rawDetail.push(gpa);
                      }); //对数据rawDetail进行去重，依靠课程代码进行去重
                      //及格重修的课程代码与首修课程代码相同，将来可能会产生bug，希望以后可以不用数据去重
                      // let cidList = {}

                      indexList = [];
                      rawDetail.forEach(function (currentTerm, index) {
                        // if (cidList[currentTerm.cid] !== true) {
                        //   cidList[currentTerm.cid] = true
                        //   indexList.push(index)
                        // }
                        indexList.push(index);
                      });
                      detail = [];
                      indexList.forEach(function (detailIndex) {
                        detail.push(rawDetail[detailIndex]);
                      }); //去重结束

                      return _context.abrupt("return", detail);

                    case 10:
                    case "end":
                      return _context.stop();
                  }
                }
              });
            }));

          case 5:
            detail = _context3.sent;
            _context3.next = 8;
            return regeneratorRuntime.awrap(this.db.execute("\n        SELECT * FROM TOMMY.H_MY_SCORE\n            WHERE CARDNUM = :cardnum\n    ", {
              cardnum: cardnum
            }));

          case 8:
            myexamData = _context3.sent;

            /*let myexamDetail = myexamData.rows.map(row => {
              return {
                _id:  row[0],
                semester: row[7],
                courseName: row[1],
                courseType: row[4],
                credit: row[2],
                score: calculateEquivalentScore(row[3]),
                isPassed: (row[3] >= 60 && row[3] <= 100) || (row[3] > 200 && row[3] <= 210),  //右边的条件是针对老系统的等级成绩的
                isFirstPassed: true,
                isHighestPassed: true,
                scoreType: row[5]
              }
            })*/
            myexamData.rows.map(function (row) {
              // eslint-disable-next-line no-unused-vars
              var _row2 = _slicedToArray(row, 8),
                  _id = _row2[0],
                  courseName = _row2[1],
                  credit = _row2[2],
                  score = _row2[3],
                  courseType = _row2[4],
                  scoreType = _row2[5],
                  cardnum = _row2[6],
                  semester = _row2[7];

              var mygpa = {
                _id: _id,
                semester: semester,
                courseName: courseName,
                courseType: courseType,
                credit: credit,
                score: calculateEquivalentScore(score),
                isPassed: score >= 60 && score <= 100 || score > 200 && score <= 210,
                //右边的条件是针对老系统的等级成绩的
                isFirstPassed: true,
                isHighestPassed: true,
                scoreType: scoreType
              };
              detail.push(mygpa);
            });
            /*for(let i=0;i<myexamDetail.length;i++){
              detail.push(myexamDetail[i])
            }*/
            // 前端要求，除去值为null的字段

            detail.forEach(function (Element) {
              for (var e in Element) {
                if (Element[e] === null) delete Element[e];
              }
            });
            courseHasPassed = {};
            achievedCredits = 0;
            detail.slice().reverse().map(function (k) {
              // 对自定义课程另外处理
              if (k._id !== undefined) {
                achievedCredits += k.credit;
              } // 赋值后判断如果是首次通过


              if (k.isFirstPassed = k.isPassed && !courseHasPassed[k.cid]) {
                courseHasPassed[k.cid] = true; // 更新已获得学分数

                achievedCredits += k.credit;
              }
            }); // 计算各门课程是否最高一次通过
            // 用于前端判断课程是否默认计入出国绩点估算

            courseHighestPassed = {};
            detail.map(function (k) {
              if (k.isPassed && (!courseHighestPassed[k.cid] || k.equivalentScore > courseHighestPassed[k.cid].equivalentScore)) {
                courseHighestPassed[k.cid] = k;
              }
            });
            Object.values(courseHighestPassed).map(function (k) {
              return k.isHighestPassed = true;
            }); // 解决转系生课程全为任选或限选的状况

            courseTypes = detail.map(function (k) {
              return k.courseType;
            });
            courseTypes = courseTypes.filter(function (k) {
              return k === '';
            });

            if (courseTypes.length === 0) {
              detail.map(function (k) {
                if (k.courseType === '限选') k.courseType = '';
              });
            } //先按学期进行排序，因为从数据库库查出来的数据不是按学期顺序排下来的


            detail = detail.sort(function (a, b) {
              if (a.semester < b.semester) {
                return -1;
              }

              if (a.semester > b.semester) {
                return 1;
              }

              return 0;
            }); // 按学期分组

            detail = detail.reduce(function (a, b) {
              var semester = b.semester;
              delete b.semester;

              if (!a.length || a.slice(-1)[0].semester !== semester) {
                return a.concat([{
                  semester: semester,
                  courses: [b]
                }]);
              } else {
                a.slice(-1)[0].courses.push(b);
                return a;
              }
            }, []);
            gpa = null;
            calculationTime = null;
            gpaBeforeMakeup = null;
            year = null; // 时间解析为时间戳
            //calculationTime = calculationTime ? +moment(calculationTime) : null

            this.logMsg = "".concat(name, " (").concat(cardnum, ") - \u67E5\u8BE2\u7EE9\u70B9"); // 数据出错，暂停查询
            // return {}

            return _context3.abrupt("return", {
              gpa: gpa,
              gpaBeforeMakeup: gpaBeforeMakeup,
              achievedCredits: achievedCredits,
              year: year,
              calculationTime: calculationTime,
              detail: detail
            });

          case 30:
            _context3.next = 32;
            return regeneratorRuntime.awrap(this.userCache('1h+', function _callee2() {
              var rawData, rawDetail, indexList, detail;
              return regeneratorRuntime.async(function _callee2$(_context2) {
                while (1) {
                  switch (_context2.prev = _context2.next) {
                    case 0:
                      _context2.next = 2;
                      return regeneratorRuntime.awrap(_this.db.execute("\n          SELECT \n          cj.KSXN,\n          cj.KSXQ,\n          xk.XKKCDM,\n          cj.KCM,\n          cj.XF,\n          cj.ZCJ,\n          cj.wid\n        FROM\n          (\n            SELECT \n              oldcj.KCMC AS KCM,\n              oldcj.XF,\n              oldcj.CJ AS ZCJ,\n              oldcj.XH,\n              oldcj.XKKCDM,\n              oldcj.KSXN,\n              oldcj.KSXQ,\n              oldcj.wid\n            FROM\n              TOMMY.T_CJGL_KSCJXX  oldcj\n            WHERE oldcj.XH = :cardnum\n          )  cj,\n          TOMMY.T_XK_XKJG  xk\n        WHERE\n          cj.XH = xk.XH AND cj.XKKCDM = xk.XKKCDM\n      ", {
                        cardnum: cardnum
                      }));

                    case 2:
                      rawData = _context2.sent;

                      /*let rawDetail = rawData.rows.map(row => {
                        let xn = parseInt(row[0])
                        let xq = parseInt(row[1])
                        let semesterName = xn.toString().slice(2)+"-"+(xn+1).toString().slice(2)+"-"+xq.toString()
                        return {
                          semester: semesterName,
                          cid: row[2],
                          courseName: row[3],
                          courseType: undefined,
                          credit: row[4],
                          score: calculateEquivalentScore(row[5]),
                          isPassed: (row[5] >= 60 && row[5] <= 100) || (row[5] > 200 && row[5] <= 210),  //右边的条件是针对老系统的等级成绩的
                          isFirstPassed: false,
                          isHighestPassed: false,
                          scoreType: undefined
                        }
                      })*/
                      rawDetail = [];
                      rawData.rows.map(function (row) {
                        var _row3 = _slicedToArray(row, 7),
                            xn = _row3[0],
                            xq = _row3[1],
                            cid = _row3[2],
                            courseName = _row3[3],
                            credit = _row3[4],
                            score = _row3[5],
                            wid = _row3[6];

                        xn = parseInt(xn);
                        xq = parseInt(xq);
                        var semesterName = xn.toString().slice(2) + "-" + (xn + 1).toString().slice(2) + "-" + xq.toString();
                        var gpa = {
                          semester: semesterName,
                          cid: wid,
                          courseNumber: cid,
                          courseName: courseName,
                          courseType: undefined,
                          credit: credit,
                          score: calculateEquivalentScore(score),
                          isPassed: score >= 60 && score <= 100 || score > 200 && score <= 210,
                          //右边的条件是针对老系统的等级成绩的
                          isFirstPassed: false,
                          isHighestPassed: false,
                          scoreType: undefined
                        };
                        rawDetail.push(gpa);
                      }); // 针对部分数据横跨新老系统的同学

                      _context2.next = 7;
                      return regeneratorRuntime.awrap(_this.db.execute("\n          select XNXQDM,a.KCH,KCM,KCXZDM,XF,ZCJ,CXCKDM\n          from (\n            select *\n            from T_CJ_LRCJ\n            where xh =:cardnum\n          )a\n          left join T_XK_XKXS\n          on a.xh = T_XK_XKXS.xh and a.kch = T_XK_XKXS.kch\n        ", {
                        cardnum: cardnum
                      }));

                    case 7:
                      rawData = _context2.sent;
                      rawData.rows.map(function (row) {
                        var _row4 = _slicedToArray(row, 7),
                            semester = _row4[0],
                            cid = _row4[1],
                            courseName = _row4[2],
                            courseType = _row4[3],
                            credit = _row4[4],
                            score = _row4[5],
                            scoreType = _row4[6];

                        var semesterName = semester ? semester.split('-') : '其他';
                        var cxckMap = new Map([['01', '首修'], ['02', '重修'], ['03', '及格重修'], ['04', '补考']]);
                        var kcxzMap = new Map([['01', '必修'], ['02', '任选'], ['03', '限选']]);

                        if (semesterName !== '其他') {
                          semesterName = "".concat(semesterName[0].slice(2), "-").concat(semesterName[1].slice(2), "-").concat(semesterName[2]);
                        }

                        var gpa = {
                          semester: semesterName,
                          cid: cid + semesterName,
                          courseNumber: cid,
                          courseName: courseName,
                          courseType: kcxzMap.get(courseType),
                          credit: credit,
                          score: calculateEquivalentScore(score),
                          isPassed: score >= 60 && score <= 100 || score > 200 && score <= 210,
                          //右边的条件是针对老系统的等级成绩的
                          isFirstPassed: false,
                          isHighestPassed: false,
                          scoreType: cxckMap.get(scoreType)
                        };
                        rawDetail.push(gpa);
                      }); //对数据rawDetail进行去重，依靠课程代码进行去重
                      //及格重修的课程代码与首修课程代码相同，将来可能会产生bug，希望以后可以不用数据去重
                      // let cidList = {}

                      indexList = [];
                      rawDetail.forEach(function (currentTerm, index) {
                        // if (cidList[currentTerm.cid] !== true) {
                        //   cidList[currentTerm.cid] = true
                        //   indexList.push(index)
                        // }
                        indexList.push(index);
                      });
                      detail = [];
                      indexList.forEach(function (detailIndex) {
                        detail.push(rawDetail[detailIndex]);
                      }); //去重结束

                      return _context2.abrupt("return", detail);

                    case 14:
                    case "end":
                      return _context2.stop();
                  }
                }
              });
            }));

          case 32:
            _detail = _context3.sent;
            _context3.next = 35;
            return regeneratorRuntime.awrap(this.db.execute("\n        SELECT * FROM TOMMY.H_MY_SCORE\n            WHERE CARDNUM = :cardnum\n    ", {
              cardnum: cardnum
            }));

          case 35:
            _myexamData = _context3.sent;

            /*let myexamDetail = myexamData.rows.map(row => {
              return {
                _id:  row[0],
                semester: row[7],
                courseName: row[1],
                courseType: row[4],
                credit: row[2],
                score: calculateEquivalentScore(row[3]),
                isPassed: (row[3] >= 60 && row[3] <= 100) || (row[3] > 200 && row[3] <= 210),  //右边的条件是针对老系统的等级成绩的
                isFirstPassed: true,
                isHighestPassed: true,
                scoreType: row[5]
              }
            })
            for(let i=0;i<myexamDetail.length;i++){
              detail.push(myexamDetail[i])
            }*/
            _myexamData.rows.map(function (row) {
              // eslint-disable-next-line no-unused-vars
              var _row5 = _slicedToArray(row, 8),
                  _id = _row5[0],
                  courseName = _row5[1],
                  credit = _row5[2],
                  score = _row5[3],
                  courseType = _row5[4],
                  scoreType = _row5[5],
                  cardnum = _row5[6],
                  semester = _row5[7];

              var mygpa = {
                _id: _id,
                semester: semester,
                courseName: courseName,
                courseType: courseType,
                credit: credit,
                score: calculateEquivalentScore(score),
                isPassed: score >= 60 && score <= 100 || score > 200 && score <= 210,
                //右边的条件是针对老系统的等级成绩的
                isFirstPassed: true,
                isHighestPassed: true,
                scoreType: scoreType
              };

              _detail.push(mygpa);
            });

            _detail.forEach(function (Element) {
              for (var e in Element) {
                if (Element[e] === null) delete Element[e];
              }
            });

            _courseHasPassed = {};
            _achievedCredits = 0;

            _detail.slice().reverse().map(function (k) {
              // 对自定义课程另外处理
              if (k._id !== undefined) {
                _achievedCredits += k.credit;
              } // 赋值后判断如果是首次通过


              if (k.isFirstPassed = k.isPassed && !_courseHasPassed[k.cid]) {
                _courseHasPassed[k.cid] = true; // 更新已获得学分数

                _achievedCredits += k.credit;
              }
            }); // 计算各门课程是否最高一次通过
            // 用于前端判断课程是否默认计入出国绩点估算


            _courseHighestPassed = {};

            _detail.map(function (k) {
              if (k.isPassed && (!_courseHighestPassed[k.cid] || k.equivalentScore > _courseHighestPassed[k.cid].equivalentScore)) {
                _courseHighestPassed[k.cid] = k;
              }
            });

            Object.values(_courseHighestPassed).map(function (k) {
              return k.isHighestPassed = true;
            }); // 解决转系生课程全为任选或限选的状况

            /*let courseTypes = detail.map(k => k.courseType)
            courseTypes = courseTypes.filter( k => k.courseType === '')
             if(courseTypes.length === 0){
            detail.map(k => {
              if(k.courseType === '限选')
                k.courseType = ''
            })
            }*/
            //先按学期进行排序，因为从数据库库查出来的数据不是按学期顺序排下来的

            _detail = _detail.sort(function (a, b) {
              if (a.semester < b.semester) {
                return -1;
              }

              if (a.semester > b.semester) {
                return 1;
              }

              return 0;
            }); // 按学期分组

            _detail = _detail.reduce(function (a, b) {
              var semester = b.semester;
              delete b.semester;

              if (!a.length || a.slice(-1)[0].semester !== semester) {
                return a.concat([{
                  semester: semester,
                  courses: [b]
                }]);
              } else {
                a.slice(-1)[0].courses.push(b);
                return a;
              }
            }, []);
            _gpa = null;
            _calculationTime = null;
            _gpaBeforeMakeup = null;
            _year = null; // 时间解析为时间戳
            //calculationTime = calculationTime ? +moment(calculationTime) : null

            this.logMsg = "".concat(name, " (").concat(cardnum, ") - \u67E5\u8BE2\u7EE9\u70B9"); // ⚠️ 出现数据同步的问题，停止查询

            return _context3.abrupt("return", {
              gpa: _gpa,
              gpaBeforeMakeup: _gpaBeforeMakeup,
              achievedCredits: _achievedCredits,
              year: _year,
              calculationTime: _calculationTime,
              detail: _detail
            });

          case 52:
            _context3.next = 68;
            break;

          case 54:
            if (!/^22/.test(cardnum)) {
              _context3.next = 68;
              break;
            }

            // 研究生
            headers = {
              'Referer': 'http://121.248.63.139/nstudent/index.aspx'
            }; // 获取成绩页

            _context3.next = 58;
            return regeneratorRuntime.awrap(this.get('http://121.248.63.139/nstudent/grgl/xskccjcx.aspx', {
              headers: headers
            }));

          case 58:
            res = _context3.sent;
            $ = cheerio.load(res.data);
            _detail2 = ['#dgData', '#Datagrid1'].map(function (k) {
              return $(k);
            }).map(function (table, i) {
              var scoreType = ['学位', '选修'][i];
              return table.find('tr').toArray().slice(1).map(function (k) {
                return $(k);
              }).map(function (tr) {
                var _tr$children$toArray$ = tr.children('td').toArray().map(function (k) {
                  return $(k).text().trim();
                }),
                    _tr$children$toArray$2 = _slicedToArray(_tr$children$toArray$, 5),
                    courseName = _tr$children$toArray$2[0],
                    credit = _tr$children$toArray$2[1],
                    semester = _tr$children$toArray$2[2],
                    score = _tr$children$toArray$2[3],
                    standardScore = _tr$children$toArray$2[4];

                credit = parseFloat(credit);
                return {
                  semester: semester,
                  courseName: courseName,
                  courseType: '',
                  credit: credit,
                  score: score,
                  standardScore: standardScore,
                  scoreType: scoreType
                };
              });
            }).reduce(function (a, b) {
              return a.concat(b);
            }, []).sort(function (a, b) {
              return b.semester - a.semester;
            }).reduce(function (a, b) {
              // 按学期分组
              var semester = b.semester;
              delete b.semester;

              if (!a.length || a.slice(-1)[0].semester !== semester) {
                return a.concat([{
                  semester: semester,
                  courses: [b]
                }]);
              } else {
                a.slice(-1)[0].courses.push(b);
                return a;
              }
            }, []);
            score = parseFloat($('#lblgghpjcj').text()); // 规格化平均成绩

            degree = parseFloat($('#lblxwxf').text()); // 学位学分

            optional = parseFloat($('#lblxxxf').text()); // 选修学分

            total = parseFloat($('#lblyxxf').text()); // 总学分

            required = parseFloat($('#lblyxxf1').text()); // 应修总学分

            credits = {
              degree: degree,
              optional: optional,
              total: total,
              required: required
            };
            return _context3.abrupt("return", {
              graduated: true,
              score: score,
              credits: credits,
              detail: _detail2
            });

          case 68:
          case "end":
            return _context3.stop();
        }
      }
    }, null, this);
  },

  /**
  * @api {POST} /api/gpa 创建自定义考试课程
  * @apiGroup gpa
  * @apiParam {String} courseName  课程名
  * @apiParam {Number} credit      学分
  * @apiParam {Number} score       分数
  * @apiParam {String} courseType  课程类型
  * @apiParam {String} scoreType   修读类型   
  * @apiParam {String} semester    学期
  **/
  post: function post(_ref) {
    var courseName, credit, score, courseType, scoreType, semester, cardnum, sql, binds, options, result;
    return regeneratorRuntime.async(function post$(_context4) {
      while (1) {
        switch (_context4.prev = _context4.next) {
          case 0:
            courseName = _ref.courseName, credit = _ref.credit, score = _ref.score, courseType = _ref.courseType, scoreType = _ref.scoreType, semester = _ref.semester;
            cardnum = this.user.cardnum; // console.log({ courseName, credit, score, courseType, scoreType, semester })

            if (courseName) {
              _context4.next = 4;
              break;
            }

            throw '未定义课程名';

          case 4:
            if (credit) {
              _context4.next = 6;
              break;
            }

            throw '未定义学分';

          case 6:
            if (score) {
              _context4.next = 8;
              break;
            }

            throw '未定义分数';

          case 8:
            if (semester) {
              _context4.next = 10;
              break;
            }

            throw '未定义学期';

          case 10:
            sql = "INSERT INTO H_MY_SCORE VALUES (sys_guid()\uFF0C:1, :2, :3, :4, :5, :6, :7 )";
            binds = [[courseName, Number(credit), Number(score), courseType, scoreType, cardnum, semester]];
            options = {
              autoCommit: true,
              bindDefs: [{
                type: oracledb.STRING,
                maxSize: 40
              }, {
                type: oracledb.NUMBER
              }, {
                type: oracledb.NUMBER
              }, {
                type: oracledb.STRING,
                maxSize: 20
              }, {
                type: oracledb.STRING,
                maxSize: 20
              }, {
                type: oracledb.STRING,
                maxSize: 20
              }, {
                type: oracledb.STRING,
                maxSize: 20
              }]
            };
            _context4.next = 15;
            return regeneratorRuntime.awrap(this.db.executeMany(sql, binds, options));

          case 15:
            result = _context4.sent;

            if (!(result.rowsAffected > 0)) {
              _context4.next = 20;
              break;
            }

            return _context4.abrupt("return", '自定义成绩成功');

          case 20:
            throw '自定义成绩失败';

          case 21:
          case "end":
            return _context4.stop();
        }
      }
    }, null, this);
  },

  /**
    * @api {DELETE} /api/gpa 删除自定义考试课程
    * @apiGroup gpa
    * @apiParam {String} _id  课程ID 
  **/
  "delete": function _delete(_ref2) {
    var _id, record, result;

    return regeneratorRuntime.async(function _delete$(_context5) {
      while (1) {
        switch (_context5.prev = _context5.next) {
          case 0:
            _id = _ref2._id;
            _context5.next = 3;
            return regeneratorRuntime.awrap(this.db.execute("\n    SELECT * FROM H_MY_SCORE\n    WHERE ID=:id\n  ", {
              id: _id
            }));

          case 3:
            record = _context5.sent;
            record = record.rows[0];

            if (record) {
              _context5.next = 7;
              break;
            }

            throw '事务不存在';

          case 7:
            _context5.next = 9;
            return regeneratorRuntime.awrap(this.db.execute("\n    DELETE FROM H_MY_SCORE\n    WHERE ID =:id\n    ", {
              id: _id
            }));

          case 9:
            result = _context5.sent;

            if (!(result.rowsAffected > 0)) {
              _context5.next = 14;
              break;
            }

            return _context5.abrupt("return", '删除成功');

          case 14:
            throw '删除失败';

          case 15:
          case "end":
            return _context5.stop();
        }
      }
    }, null, this);
  },

  /**
    * @api {PUT} /api/gpa 修改自定义考试课程
    * @apiGroup gpa
    * @apiParam {String} courseName  课程名
    * @apiParam {Number} credit      学分
    * @apiParam {Number} score       分数
    * @apiParam {String} courseType  课程类型
    * @apiParam {String} scoreType   修读类型   
    * @apiParam {String} semester    学期
    * @apiParam {String} _id         课程ID
    **/
  put: function put(_ref3) {
    var _id, courseName, credit, score, courseType, scoreType, semester, record, result;

    return regeneratorRuntime.async(function put$(_context6) {
      while (1) {
        switch (_context6.prev = _context6.next) {
          case 0:
            _id = _ref3._id, courseName = _ref3.courseName, credit = _ref3.credit, score = _ref3.score, courseType = _ref3.courseType, scoreType = _ref3.scoreType, semester = _ref3.semester;

            if (_id) {
              _context6.next = 3;
              break;
            }

            throw '未定义id';

          case 3:
            _context6.next = 5;
            return regeneratorRuntime.awrap(this.db.execute("\n    SELECT * FROM H_MY_SCORE\n    WHERE ID=:id\n    ", {
              id: _id
            }));

          case 5:
            record = _context6.sent;
            record = record.rows[0];

            if (record) {
              _context6.next = 9;
              break;
            }

            throw '事务不存在';

          case 9:
            if (!courseName) {
              courseName = record[1];
            }

            if (!credit) {
              credit = record[2];
            }

            if (!score) {
              score = record[3];
            }

            if (!courseType) {
              courseType = record[4];
            }

            if (!scoreType) {
              scoreType = record[5];
            }

            if (!semester) {
              semester = record[7];
            }

            _context6.next = 17;
            return regeneratorRuntime.awrap(this.db.execute("\n    UPDATE H_MY_SCORE SET \n      COURSENAME=:courseName, \n      CREDIT=:credit, \n      SCORE=:score, \n      COURSETYPE=:courseType, \n      SCORETYPE=:scoreType, \n      SEMESTER=:semester \n    WHERE ID=:id\n    ", {
              courseName: courseName,
              credit: credit,
              score: score,
              courseType: courseType,
              scoreType: scoreType,
              semester: semester,
              id: _id
            }));

          case 17:
            result = _context6.sent;

            if (!(result.rowsAffected > 0)) {
              _context6.next = 22;
              break;
            }

            return _context6.abrupt("return", '更新成功');

          case 22:
            throw '更新失败';

          case 23:
          case "end":
            return _context6.stop();
        }
      }
    }, null, this);
  }
};