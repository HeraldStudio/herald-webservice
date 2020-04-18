exports.route = {
  /**
  * @api {GET} /api/version 获取 App 版本信息
  * @apiGroup other
  * @apiParam {String} version
  */
  // 获取更新信息
  async get({ version }) {
    // 验证是否符合版本号格式
    if (!(/^\d+\.\d+\.\d+$/.test(version))) {
      throw '参数不符合规范'
    }
    let { token, cardnum, platform } = this.user
    let record
    // 获取最新版本
    if (platform === 'app-zsqn-ios') {
      console.log(111)
      record = await this.db.execute(`
      SELECT VERSION_NUM, CREATEDTIME, DESCRIPTION, DOWNLOAD_URL
      FROM H_VERSION
      WHERE CREATEDTIME IN (
        SELECT MAX(CREATEDTIME)
        FROM H_VERSION
        WHERE PLATFORM = 'app-zsqn-ios'
      )AND PLATFORM = 'app-zsqn-ios'
    `)
    } else {
      record = await this.db.execute(`
      SELECT VERSION_NUM, CREATEDTIME, DESCRIPTION, DOWNLOAD_URL
      FROM H_VERSION
      WHERE CREATEDTIME IN (
        SELECT MAX(CREATEDTIME)
        FROM H_VERSION
        WHERE PLATFORM = 'app-android'
      )AND PLATFORM = 'app-android'
    `)
    }

    // 用户数据统计
    await this.db.execute(`
    INSERT INTO
    H_USER_STATISTICS
    (TOKEN_HASH, CARDNUM, PLATFORM, VERSION)
    VALUES (:token, :cardnum, :platform, :version)
    `, {
      token,
      cardnum,
      platform,
      version
    })
    record = record.rows.map(Element => {
      let [version, createdTime, desc, downloadUrl] = Element
      return { version, createdTime, desc, downloadUrl }
    })[0]
    console.log(record)
    if (version !== record.version) {
      return {
        isLatest: false,                              // 是否最新版本
        version: record.version,                      // 最新版本号
        desc: record.desc,                            // 版本描述
        updateTime: record.createdTime,               // 版本更新时间
        downloadUrl: record.downloadUrl               // 下载地址
      }
    } else {
      return {
        isLatest: true
      }
    }
  }
}