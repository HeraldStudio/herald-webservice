"use strict";

/**
 * term 学期信息中间件
 * 提供获取当前学期、学期计算等 API，方便使用。
 * 
 * 可通过 this.term.list 得到已知的学期列表，
 * this.term.nextTerm 得到下个学期，this.term.prevTerm 得到上个学期，this.term.currentTerm 得到当前学期
 * 
 * 👇是以前的说明
 * 只要 config.yml 配置准确，上下个学期不会为空，但当前学期可以为空
 * 因此在路由中编程时，获取当前学期一定要考虑到当前为假期的情况，
 * 如果处于假期时需要展示下学期，则改用 this.term.current || this.term.next，以此类推。
 * 👆是以前的说明
 * 
 * currentTerm 当前学期永不为空，prevTerm 和 currentTerm 可能为空
 * 当处于假期时，如果有开学后的假期，则 currentTerm 为开学后的学期，否则为假期前的学期
 * {
    "list": [
      {
        "name": "2017-2018-1",
        "startDate": "2017-08-10 00:00:00",
        "endDate": "2017-09-07 00:00:00",
        "isCurrent": false,
        "isNext": false,
        "isPrev": false,
        "isLong": false,
      },
      ...
    ],
    "nextTerm": {
      "name": "2020-2021-1",
      "startDate": "2020-06-29 00:00:00",
      "endDate": "2020-07-27 00:00:00",
      "isCurrent": false,
      "isNext": true,
      "isPrev": false,
      "isLong": false
    },
    "prevTerm": {
      "name": "2019-2020-2",
      "startDate": "2019-09-16 00:00:00",
      "endDate": "2020-01-20 00:00:00",
      "isCurrent": false,
      "isNext": false,
      "isPrev": true,
      "isLong": true
    },
    "currentTerm": {
      "name": "2019-2020-3",
      "startDate": "2020-02-24 00:00:00",
      "endDate": "2020-06-29 00:00:00",
      "isCurrent": true,
      "isNext": false,
      "isPrev": false,
      "isLong": true
    }
  }
 */
var _require = require('../app'),
    config = _require.config; // 先算好静态的学期框架，然后在请求内部只计算跟当前时间有关的东西
// 注意这个数组不能在运行时被修改，需要用一定的机制来保证，下面 get() 中会实现这种机制
// 规范一下时间格式 'YYYY-MM-DD YYYY-MM-DD HH:mm:ss' 


var terms = Object.keys(config.term).map(function (k) {
  var startMoment = moment(config.term[k], 'YYYY-MM-DD');
  var startDate = +startMoment;
  var endDate = +startMoment.add(/-1$/.test(k) || /-4$/.test(k) ? 4 : 18, 'weeks');
  return {
    name: k,
    startDate: startDate,
    endDate: endDate
  };
}).reduce(function (a, b) {
  return a.concat(b);
}, []);

module.exports = function _callee(ctx, next) {
  return regeneratorRuntime.async(function _callee$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          // 定义一个不可以被修改的属性，详情参考 MDN Object.defineProperty
          Object.defineProperty(ctx, 'term', {
            get: function get() {
              var now = +moment(); // 需要记录一个上一个学期的结束时间 起始值是一个比较早的时间

              var prevEndDate = +moment('1998-11-25 00:00:00', 'YYYY-MM-DD HH:mm:ss');
              var currentTerm = null;
              var nextTerm = null;
              var prevTerm = null;
              var index = 0; // 注意，每次请求 ctx.term 时都会执行下面的计算，请务必注意全局 term 对象的可重用问题以及性能问题

              var term = {
                list: terms.map(function (k) {
                  // console.log(k.startDate.format('YYYY-MM-DD HH:mm:ss'))
                  // console.log(k.endDate.format('YYYY-MM-DD HH:mm:ss'))
                  // 由于 k 中的属性的都是基本类型，这里可以用单层深拷贝代替深拷贝，将 k 中的属性复制一份到新对象，防止修改 k 的属性
                  // 详情可以参考 MDN Object.assign
                  k = Object.assign({}, k);
                  k.isCurrent = false;
                  k.isNext = false;
                  k.isPrev = false;
                  k.isLong = !/-1$/.test(k.name);
                  k.index = index; // 确定当前学期

                  if (now >= prevEndDate && now < k.endDate) {
                    k.isCurrent = true;
                  }

                  prevEndDate = k.endDate;
                  index = index + 1;
                  if (k.isCurrent) currentTerm = Object.assign({}, k);
                  return k;
                })
              };
              currentTerm = currentTerm !== null ? currentTerm : term.list[term.list.length - 1];
              term.list[currentTerm.index].isCurrent = true;

              if (currentTerm.index + 1 < term.list.length) {
                nextTerm = term.list[currentTerm.index + 1];
                term.list[currentTerm.index + 1].isNext = true;
                nextTerm.isNext = true;
                delete nextTerm.index;
              }

              if (currentTerm.index - 1 >= 0) {
                prevTerm = term.list[currentTerm.index - 1];
                term.list[currentTerm.index - 1].isPrev = true;
                prevTerm.isPrev = true;
                delete prevTerm.index;
              }

              term.nextTerm = nextTerm;
              term.prevTerm = prevTerm;
              term.currentTerm = currentTerm;
              delete term.currentTerm.index;
              term.list = term.list.map(function (k) {
                delete k.index;
                return k;
              });
              return term;
            }
          });
          _context.next = 3;
          return regeneratorRuntime.awrap(next());

        case 3:
        case "end":
          return _context.stop();
      }
    }
  });
};