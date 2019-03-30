// 管理员清理cache的请求

exports.route = {
  async get () {
    if (!this.admin || !this.admin.maintenance) {
      throw 403
    }
    throw 'Delete ONLY'
  },
  async delete ({ cacheName }) {
    if (!this.admin || !this.admin.maintenance) {
      throw 403
    }
    if (!cacheName) {
      throw '只允许清理指定路由'
    }

    await this.clearAllCache(cacheName)
    
    return 'OK'
  }
}