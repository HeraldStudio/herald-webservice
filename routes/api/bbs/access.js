exports.route = {
  // 控制bbs是否可用
  async get() {
    return {
      access: false
    }
  }
}