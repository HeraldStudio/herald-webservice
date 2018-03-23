exports.route = {
  get () {
    this.related('publish', {
      get: '{ page, pagesize } [发布者] 获取自己发布的活动列表',
      post: '{ activity } [发布者] 发布活动，进入未审核状态',
      put: '{ activity } [发布者] 修改自己发布的活动并同时使审核失效',
      delete: '{ aid } [发布者] 删除自己发布的活动'
    })
    this.related('manage', {
      get: '{ page, pagesize } [运营者] 获取活动列表',
      post: '{ activity } [运营者] 发布活动，进入未审核状态',
      put: '{ activity } [运营者] 修改并同时审核活动',
      delete: '{ aid } [运营者] 删除活动'
    })
  }
}
