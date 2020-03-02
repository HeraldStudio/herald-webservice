exports.route = {
  // 获取更新信息
  async get({ version }) {
    let { token, cardnum, platform } = this.user
    let record = await this.db.execute(`
    SELECT VERSION_NUM, CREATEDTIME, DESCRIPTION, DOWNLOAD_URL
    FROM H_VERSION
    WHERE CREATEDTIME IN (
      SELECT MAX(CREATEDTIME)
      FROM H_VERSION
    )
  `)
    await this.db.execute(`
    INSERT INTO
    H_USER_STATISTICS
    (TOKEN_HASH, CARDNUM, PLATFORM)
    VALUES (:token, :cardnum, :platform)
    `,{
      token,
      cardnum,
      platform
    })
    record = record.rows.map(Element => {
      let [version, createdTime, desc, downloadUrl] = Element
      return { version, createdTime, desc, downloadUrl }
    })[0]
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