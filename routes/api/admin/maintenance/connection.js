const counter = require('../../../../middleware/counter')
const spider = require('../../../../middleware/spider-server')
const redis = require('../../../../middleware/redis')
const startTime = +moment()

exports.route = {
  /**
   * 当前服务的状态
   * GET /api/admin/maintenance/connection
   * @return requestCount 请求数量
   * @return spiders 爬虫的状态
   * @return startTime 开始时间
   * @return detachedTaskCount
   */
  async get() {
    if (!await this.hasPermission('maintenance')) {
      throw 403
    }
    let requestCount = counter.connections - 1 // 去掉当前请求自身
    let detachedTaskCount = redis.detachedTaskCount
    let spiders = spider.spiders
    return { requestCount, spiders, startTime, detachedTaskCount }
  },
  
  /**
   * 拒绝爬虫，即使你拒绝了，爬虫也会爬上来，等效重新连接一个硬件爬虫
   * (阿门阿前，一个服务器，阿门阿前，一个爬虫爬上来)
   * DELETE /api/admin/maintenance/connection
   * @param name 爬虫的名称
   */
  async delete({ name }) {
    if (!await this.hasPermission('maintenance')) {
      throw 403
    }
    if (!name){
      throw '未指定爬虫'
    }
    spider.rejectSpider(name)

    return 'OK'
  }
}
