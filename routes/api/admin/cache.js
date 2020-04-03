/**
 * 管理员管理缓存路由
 * GET /api/admin/cache 
 * DELETE /api/admin/cache
 * @Params keykeyword
 * 
 * 例如：GET /api/admin/cache { keyword:'213171610' }
 * 例如：GET /api/admin/cache { keyword:'/api/gpa' }
 * 
 * 例如：DELETE /api/admin/cache { keyword:'213171610' }
 * 例如：DELETE /api/admin/cache { keyword:'/api/gpa' }
 * 
 */

exports.route = {
  async get ({ keyword = '' }) {
    if (!this.user.isLogin) {
      throw 401
    }
    await this.hasPermission('maintenance')

    await this.getCache(keyword)
    
    return 'OK'
  },
  async delete ({ keyword = '' }) {
    if (!this.user.isLogin) {
      throw 401
    }
    await this.hasPermission('maintenance')

    await this.clearCache(keyword)
    
    return 'OK'
  }
}