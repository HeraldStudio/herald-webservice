exports.route = {
  async get({ annex }) {
    // 获取minio 生成的临时下载链接，有效期一小时
    let url = await new Promise((resolve, reject) => {
      this.minio.presignedGetObject('annex', annex, 60 * 60, async (err, presignedUrl) => {
        if (err) {
          reject(err)
          throw '获取文件失败'
        }
        resolve(presignedUrl)
      })
    })
    return url
  }
}
