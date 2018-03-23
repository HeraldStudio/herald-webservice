exports.route = {
  get () {
    this.related('maintenance', '运维相关的操作')
    this.related('activity', '活动发布审核相关的操作')
    this.related('banner', {
      get: '[运营者] 获取轮播图列表',
      post: '{ banner } [运营者] 发布轮播图',
      put: '{ banner } [运营者] 修改轮播图',
      delete: '{ bid } [运营者] 删除轮播图'
    })
    this.related('notice', {
      get: '[运维] 获取系统公告列表',
      post: '{ banner } [运维] 发布系统公告',
      put: '{ banner } [运维] 修改系统公告',
      delete: '{ bid } [运维] 删除系统公告'
    })
    this.related('admin', {
      get: '{ domain?: string } 不带 domain [用户] 获取当前用户管理员身份；带 domain [同域/超管] 获取某域下管理员列表',
      post: '{ domain, admin: { name, cardnum, phone }} [同域/超管] 任命下级管理员',
      delete: '{ domain, cardnum } [上级同域/超管] 删除管理员'
    })
  }
}
