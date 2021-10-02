exports.route = {
  /**
  * @api {GET} /api/scholarship 获取校历（图片地址）
  * @apiGroup other
  */
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
    return 'https://tommy.seu.edu.cn/static/images/2021-2022.jpg'
  }
}