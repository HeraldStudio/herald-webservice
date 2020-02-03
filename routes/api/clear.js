/**
 * 清理用户缓存
 * GET /api/clear
 */
exports.route = {
  async get () {
    if (!this.user.isLogin ){
      // 清理用户缓存必须先登录
      throw 401
    }
    await this.clearUserCache()
    return 'OK'
  }
}