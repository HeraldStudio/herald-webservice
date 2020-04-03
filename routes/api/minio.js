exports.route = {
      /**
  * @api {GET} /api/annex 附件下载接口
  * @apiParam {String} annex
  */
  async get({ annex }) {
    if (!annex) {
      throw '参数不全'
    }
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
    let res, error
    try {
      res = await this.get(url)
    } catch (err) {
      error = err.response.status
    }
    if (error === 404) {
      throw '文件不存在'
    } else {
      let filename = annex.split('/').pop()
      this.set('Content-Disposition', `attachment;filename=${encodeURI(filename)}`)
      this.set('x-document', 'minio')
    }
    return {
      res
    }
  }
}
