exports.route = {
  get () {
    this.related('control/pull', '[运维] Git 更新')
    this.related('control/restart', '[运维] 系统重启')
    this.related('status', '有关系统状态监测的接口')
    this.related('admin', {
      get: '{ domain?: string } 不带 domain [用户] 获取当前用户管理员身份；带 domain [同域/超管] 获取某域下管理员列表',
      post: '{ domain, admin: { name, cardnum, phone }} [同域/超管] 任命下级管理员',
      delete: '{ domain, cardnum } [上级同域/超管] 删除管理员'
    })
  }
}
