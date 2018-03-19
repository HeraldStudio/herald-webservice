exports.route = {
  get () {
    this.related('admin', '所有管理员端接口')
    this.related('activity', '{ page, pagesize } 获取校园活动列表')
    this.related('banner', '获取轮播图列表')
    this.related('card', {
      get: '{ date?: yyyy-M-d, page? } 一卡通信息及消费流水，不带 date 为当日流水',
      put: '{ password, amount: float, eacc?=1 } 一卡通在线充值'
    })
    this.related('curriculum', '{ term? } 课表查询（返回格式可能随上游可用性变化）')
    this.related('exam', '考试查询')
    this.related('gpa', '成绩及绩点查询')
    this.related('health', '上游网站状态查询')
    this.related('lecture', '讲座打卡记录')
    this.related('library', {
      get: '{ password?: 图书馆密码 } 查询已借图书',
      post: '{ cookies, bookId, borrowId } 续借图书'
    })
    this.related('notice', {
      get: '获取所有通知公告列表',
      post: '{ url?, nid? } 学校通知或小猴公告解析为 Markdown'
    })
    this.related('pe', '跑操及体测成绩查询')
    this.related('phylab', '物理实验查询')
    this.related('qiniu', '前端执行七牛上传所需的 uptoken')
    this.related('reservation', '{ method, ... } 场馆预约，具体参见代码')
    this.related('srtp', 'SRTP 学分及项目查询')
    this.related('term', '本学年学期列表查询')
    this.related('user', '用户信息查询')
    this.related('wlan', {
      get: '校园网状态查询',
      post: '{ months: int } 自动开通/续期/解锁',
      delete: '{ ip?, mac? } 下线IP/删除免认证设备'
    })
  }
}
