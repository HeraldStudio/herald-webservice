exports.route = {
  /**
  * @api {GET} /api/notification/unread 获取未读通知的数量
  * @apiGroup notice
  */
  async get() {
    let {cardnum} = this.user
    let count = await this.db.execute(`
      SELECT COUNT (*)
      FROM (
        SELECT NOTIFICATION_ID, READTIME
        FROM H_NOTIFICATION_ISREAD
        WHERE CARDNUM = :cardnum AND READTIME IS NULL
      )A
        LEFT JOIN H_NOTIFICATION
        ON H_NOTIFICATION.ID = A.NOTIFICATION_ID 
      `, 
    {
      cardnum
    })

    return {unread:count.rows[0][0]?count.rows[0][0]:0}
  },

}