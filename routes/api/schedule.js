exports.route = {

  /**
   * GET /api/schedule
   * 获取校历（图片地址）
   */
  async get() {
    if (!this.user.isLogin){
      // 不登录都给我爬
      throw 403
    }
    // 将校历图片上传到outline服务器，直接图片连接
    return 'https://static.myseu.cn/schedule_2019.jpg'
  }
}