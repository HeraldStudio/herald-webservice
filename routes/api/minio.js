exports.route = {
  async get({ annex }) {
    let url
    try {
      url = await new Promise((resolve, reject) => {
        this.minio.presignedGetObject('annex', annex, 60 * 60, async (err, presignedUrl) => {
          if (err) {
            console.log(err)
            reject(err)
            throw '下载文件失败'
          }
          resolve(presignedUrl)
        })
      })
    } catch (err) {
      throw '下载文件失败'
    }
    let res = await this.get(url)
    let filename = annex.split('/').pop()
    this.set('Content-Disposition',`attachment;filename=${encodeURI(filename)}`)
    return {
      res,
      filename
    }
  }
}
