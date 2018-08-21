/**
 * term 学期信息中间件
 * 提供获取当前学期、学期计算等 API，方便使用。
 * 
 * 可通过 this.term.list 得到已知的学期列表，
 * this.term.next 得到下个学期，this.term.prev 得到上个学期，this.term.current 得到当前学期
 * 只要 config.yml 配置准确，上下个学期不会为空，但当前学期可以为空
 * 因此在路由中编程时，获取当前学期一定要考虑到当前为假期的情况，
 * 如果处于假期时需要展示下学期，则改用 this.term.current || this.term.next，以此类推。
 * {
    "list": [
      {
        "name": "17-18-3",
        "startDate": 1519574400000,
        "endDate": 1530460800000,
        "isCurrent": false,
        "isNext": false,
        "isPrev": true,
        "isLong": true
      },
      ...
    ],
    "next": {
      "name": "18-19-1",
      "startDate": 1534694400000,
      "endDate": 1537113600000,
      "isCurrent": false,
      "isNext": true,
      "isPrev": false,
      "isLong": false
    },
    "prev": {
      "name": "17-18-3",
      "startDate": 1519574400000,
      "endDate": 1530460800000,
      "isCurrent": false,
      "isNext": false,
      "isPrev": true,
      "isLong": true
    },
    "current": null
  }
 */
const { config } = require('../app')

// 先算好静态的学期框架，然后在请求内部只计算跟当前时间有关的东西
// 注意这个数组不能在运行时被修改，需要用一定的机制来保证，下面 get() 中会实现这种机制
const terms = Object.keys(config.term).map(k => {
  let startMoment = moment(config.term[k], 'YYYY-M-D')
  let startDate = +startMoment
  let endDate = +startMoment.add(/-1$/.test(k) ? 4 : 18, 'weeks')
  return { name: k, startDate, endDate }
}).reduce((a, b) => a.concat(b), [])

module.exports = async (ctx, next) => {
  Object.defineProperty(ctx, 'term', {
    get() {
      let now = +moment()
      let current = null
      let next = null
      let prev = null

      // 注意，每次请求 ctx.term 时都会执行下面的计算，请务必注意全局 term 对象的可重用问题以及性能问题
      let term = {
        list: terms.map(k => {

          // 由于 k 中的属性的都是基本类型，这里可以用单层深拷贝代替深拷贝，将 k 中的属性复制一份到新对象，防止修改 k 的属性
          k = Object.assign({}, k)

          k.isCurrent = k.startDate <= now && k.endDate > now
          if (k.isCurrent) {
            current = k
          }

          k.isNext = false
          if (k.startDate > now && (next == null || k.startDate < next.startDate)) {
            next = k
          }

          k.isPrev = false
          if (k.endDate <= now && (prev == null || k.endDate > prev.endDate)) {
            prev = k
          }

          k.isLong = !/-1$/.test(k.name)
          return k
        })
      }
      //！ hotfix
      // next = {
      //   name: '18-19-2',
      //   startDate: 1537113600000,
      //   endDate: 1548000000000,
      //   isCurrent: false,
      //   isNext: false,
      //   isPrev: false,
      //   isLong: true
      // }
      next.isNext = true
      prev.isPrev = true
      term.next = next
      term.prev = prev
      term.current = current
      return term
    }
  })
  await next()
}