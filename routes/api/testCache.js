exports.route = {
  async get() {
    let res = await this.userCache('1h2m1s+', async () => {
      return 'testCache'
    })
    return res
  }
}