const wx = require('../../sdk/wechat').getAxios('wx-herald')

exports.route = {
  // 获取公众号最近推送文章
  async get ({ date }) {
    // let date = moment().subtract(1, 'day').format('YYYY-MM-DD')
    let res = await wx.post('https://api.weixin.qq.com/datacube/getarticlesummary', {
      begin_date: date,
      end_date: date
    })
    return res.data
    // let res = await wx.post('/material/batchget_material', {
    //   type: 'news',
    //   offset: (page - 1) * pagesize,
    //   count: pagesize
    // })
    // return (res.data.item || []).map(k => {
    //   let { content: { news_item : content }} = k
    //   content = content.map(k => {
    //     let {
    //       title, author, digest: summary, url,
    //       'thumb_url': pic,
    //       'thumb_media_id': thumbMediaId,
    //       'content_source_url': sourceUrl,
    //       'need_open_comment': commentEnabled
    //     } = k

    //     commentEnabled = !!commentEnabled

    //     return {
    //       title, author, summary, url, pic, thumbMediaId,
    //       sourceUrl, commentEnabled
    //     }
    //   })
    //   return content
    // })
  }
}