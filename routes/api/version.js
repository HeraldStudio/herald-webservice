exports.route = {
  // 获取更新信息
  async get({ version }) {
    // 验证是否符合版本号格式
    if(!(/^\d+\.\d+\.\d+$/.test(version))){
      throw '参数不符合规范'
    }
    let { token, cardnum, platform } = this.user
    // 获取最新版本
    let record = await this.db.execute(`
    SELECT VERSION_NUM, CREATEDTIME, DESCRIPTION, DOWNLOAD_URL
    FROM H_VERSION
    WHERE CREATEDTIME IN (
      SELECT MAX(CREATEDTIME)
      FROM H_VERSION
    )
  `)
    // 用户数据统计
    await this.db.execute(`
    INSERT INTO
    H_USER_STATISTICS
    (TOKEN_HASH, CARDNUM, PLATFORM, VERSION)
    VALUES (:token, :cardnum, :platform, :version)
    `,{
      token,
      cardnum,
      platform,
      version
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