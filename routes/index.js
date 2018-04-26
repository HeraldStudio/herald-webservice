exports.route = {
  get() {
    // 对于前后端分离的严格 RESTful 系统，后端不应该做重定向，重定向是违背格式的
    // 但这里 index 不是一个 API，而是类似于一个项目 Hello World 的展示功能，所以允许重定向了
    this.redirect('https://github.com/heraldstudio/herald-webservice')
  }
}
