exports.route = {
  async get () {
    await this.clearUserCache()
    return 'OK'
  }
}