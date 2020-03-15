const moment = require('moment')
const uuid = require('uuid/v4')
const oracledb = require('oracledb')
const JPushKeys = require('../../../sdk/sdk.json').JPush
const Base64 = require('js-base64').Base64
const axios =require('axios')

exports.route = {
  /**
   * GET /api/notification/unread
   * 
   * 获取未读通知的数量
   * 
   * @returns {Number} 
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

    return count.rows[0][0]
  },

}