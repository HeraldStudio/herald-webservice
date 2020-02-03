exports.route = {
  get () {
    this.related('maintenance', '运维相关的操作')
    this.related('activity', '活动发布审核相关的操作')
    this.related('banner', {
      get: '具有 publicity 权限管理员获取轮播图列表',
      post: '{ banner } 发布轮播图',
      put: '{ banner } 修改轮播图',
      delete: '{ id } 删除轮播图'
    })
    this.related('notice', {
      get: '具有 publicity 权限管理员获取系统公告列表',
      post: '{ notice } 发布系统公告',
      put: '{ notice } 修改系统公告',
      delete: '{ id } 删除系统公告'
    })
    this.related('admin', {
      get: '带 domain 参数表示查询指定域下的管理员；不带 domain 参数表示查询自己的管理员身份',
      post: '{ domain, admin: { name, cardnum, phone } } 给予下级管理员权限',
      put: '{ admin: { name, cardnum, phone } } 修改管理员信息',
      delete: '{ domain, cardnum }  删除下级管理员权限'
    })
  }
}
