exports.route = {

  async post({ title, content, tag, target, annex, role, cardnum, source }) {
    if (!(title && content)) {
      throw '参数不全'
    }
    if (title.length > 60) {
      throw '标题过长'
    }
    if (content.length > 1200) {
      throw '内容过长'
    }
    if (!role) {
      throw 403
    }
    let time = +moment()
    await this.db.execute(`
      INSERT INTO H_NOTIFICATION
      (TITLE, CONTENT, PUBLISHER, PUBLISHTIME, ROLE, TAG, ANNEX, SOURCE)
      VALUES(:title, :content, :cardnum, :time, :role, :tag, :annex, :source)
      `, {
      title,
      content,
      cardnum,
      time,
      role,
      tag,
      annex,
      source
    })
    return '推送成功'
  }
}