exports.route = {
  async get() {
    let res = await this.userCache('1h2m1h+', async () => {
      return 'testCache'
    })
    return res
  }
}