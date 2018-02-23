const counter = require('../../../middleware/counter')
const spider = require('../../../middleware/spider_server')

exports.route = {
  async get() {
    if (!this.admin.maintenance) {
      throw 403
    }
    let requestCount = counter.connections - 1 // 去掉当前请求自身
    let spiders = spider.spiders
    return { requestCount, spiders }
  },
  async post() {
    if (!this.admin.maintenance) {
      throw 403
    }
    spider.acceptSpider(this.params.name)
  },
  async delete() {
    if (!this.admin.maintenance) {
      throw 403
    }
    spider.rejectSpider(this.params.name)
  }
}
