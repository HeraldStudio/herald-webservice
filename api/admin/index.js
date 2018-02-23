exports.route = {
  get () {
    this.related('maintenance', '运维相关的操作')
    this.related('publicity', {
      get: '{ type: string, page, pagesize } [运营者/发布者] 获取内容列表',
      post: '{ publicity: object } [运营者/发布者] 发布内容',
      put: '{ pid } [运营者] 审核内容',
      delete: '{ pid } [运营者/发布者] 删除内容'
    })
    this.related('admin', {
      get: '{ domain?: string } 不带 domain [用户] 获取当前用户管理员身份；带 domain [同域/超管] 获取某域下管理员列表',
      post: '{ domain, admin: { name, cardnum, phone }} [同域/超管] 任命下级管理员',
      delete: '{ domain, cardnum } [上级同域/超管] 删除管理员'
    })
  }
}
