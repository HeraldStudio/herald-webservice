const cheerio = require('cheerio')

exports.route = {
  /**
   * GET /api/wechat
   * 抓取微信推送链接，解析为标准 html 内容以便前端展示
   */
  async get({ url }) {
    return await this.publicCache('1mo', async () => {
      const re = /^(https?:\/*)?mp\.weixin\.qq\.com/g
      if (!re.test(url)) {
        throw 404
      }

      // URL 标准化
      url = url.replace(re, 'https://mp.weixin.qq.com')

      // 这里很多东西不能直接取 html，而且有小程序端搬过来的成熟方案，所以干脆不用 cheerio 了
      let res = await this.get(url)
      let title = (/[^.]rich_media_title_ios[^>]*>\s*([^<]*)\s*</img.exec(res.data) || [])[1]
      let author = (/[^.]profile_nickname[^>]*>\s*([^<]*)\s*</img.exec(res.data) || [])[1]
      let authorId = (/微信号[\s\S]*?profile_meta_value">([^<]*)</img.exec(res.data) || [])[1]
      let qrcode = 'https://mp.weixin.qq.com/mp/qrcode?scene=10000004&size=102&' +
        /(__biz=.*?)&chksm=/.exec(/var msg_link = "(.+)";/.exec(res.data)[1].replace(/\\x26amp;/g, '&'))

      // HTML 格式转换
      let html = res.data

        // 去除 HTML 注释或头，小程序端无法解析注释
        .replace(/<!([^<>]*<[^<>]*>)*[^<>]*>/g, '')

        // 去除不支持的内容标签；微信推送的 CSS 多用内联式，几乎用不到 style
        .replace(/<(script|style|title|h2|svg|iframe)[\s\S]*?<\/\s*\1>/img, '')

      // 取正文内容
      html = cheerio.load(res.data)('.rich_media_content').html()

        // section 替换为 p
        .replace(/(<\/?\s*)section(?=[^A-Za-z\-])(.*?>)/img, '$1p$2')

        // em 替换为 strong
        .replace(/(<\/?\s*)em(?=[^A-Za-z\-])(.*?>)/img, '$1strong$2')

        // 懒加载的图片链接 data-src 替换为 src
        .replace(/(<img[^>]+)data-src=/img, '$1 src=')

        // 有 style 的图片添加最大宽度 100%
        .replace(/(<img[^>]+style=")([^>]+>)/img, '$1max-width: 100%;$2')

        // 无 style 的图片添加最大宽度 100%
        .replace(/(<img[^>]*?)(\/?>)/img, '$1 style="max-width: 100%;"$2')

        // 用 HTML 语法设置宽度高度的一律去除
        .replace(/(width|height)="[^"]+"/img, '')

        // 原文链接去除
        .replace(/<a[^>]*?>阅读原文<\/\s*a>/img, '')

        // 去除不规范的标签内连续多个等号（lang=="en"），否则小程序端崩溃
        .replace(/(<[^>]*)==([^>]*>)/img, '$1=$2')

        // 去除秀米垃圾
        .replace(/ class="Powered-by-XIUMI V5"| powered-by="xiumi\.us"/img, '')

      return { title, author, authorId, qrcode, html }
    })
  }
}