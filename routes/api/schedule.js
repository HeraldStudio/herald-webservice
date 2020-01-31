exports.route = {

  /**
   * GET /api/schedule
   * 获取校历（图片地址）
   */
  async get() {
    if (!this.user.isLogin){
      // 不登录都给我爬
      throw 401
    }
    // 将校历图片上传到outline服务器，直接图片连接
    return 'https://tommy.seu.edu.cn/static/images/2019-2020.jpg'
  }
}