exports.route = {
  async get() {
    let openid = this.openid
    // 防止重复发送，清除已有记录
    await this.db.execute(`
    DELETE FROM H_NOTIFICATION
    WHERE TYPE = 'wechat' AND FUNCTION = '跑操提醒' AND OPENID = :openid
    `, { openid })
    await this.db.execute(`
    INSERT INTO H_NOTIFICATION 
    ( TYPE, FUNCTION, OPENID )
    VALUES
    ( 'wechat', '跑操提醒', :openid )
    `, { openid })
    // 检查是否设置成功
    let record = await this.db.execute(`
    SELECT * FROM H_NOTIFICATION
    WHERE TYPE = 'wechat' AND FUNCTION ='跑操提醒' AND OPENID =:openid
    `, { openid })
    if (record.rows.length === 1) {
      return '设置成功'
    } else {
      return '设置失败'
    }
  },

  async delete() {
    let openid = this.openid
    // 清除已有记录
    let result = await this.db.execute(`
    DELETE FROM H_NOTIFICATION
    WHERE TYPE = 'wechat' AND FUNCTION = '跑操提醒' AND OPENID = :openid
    `, { openid })
    // 检查是否删除成功
    if (result.rowsAffected === 1) {
      return '删除成功'
    } else {
      return '删除失败'
    }
  }
}