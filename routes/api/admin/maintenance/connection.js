const counter = require('../../../../middleware/counter')
const spider = require('../../../../middleware/spider-server')
const redis = require('../../../../middleware/redis')
const startTime = +moment()

exports.route = {
  async get() {
    if (!this.admin || !this.admin.maintenance) {
      throw 403
    }
    let requestCount = counter.connections - 1 // 去掉当前请求自身
    let detachedTaskCount = redis.detachedTaskCount
    let spiders = spider.spiders
    return { requestCount, spiders, startTime, detachedTaskCount }
  },
  async post({ name }) {
    if (!this.admin || !this.admin.maintenance) {
      throw 403
    }
    spider.acceptSpider(name)
  },
  async delete({ name }) {
    if (!this.admin || !this.admin.maintenance) {
      throw 403
    }
    spider.rejectSpider(name)
  }
}
