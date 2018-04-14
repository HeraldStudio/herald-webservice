const { jieba, has, enqueue, dequeue, sleep, log, push, filter } = require('./common')
const axios = require('axios').create({ timeout: 3000 })
const chardet = require('jschardet')
const iconv = require('iconv')
const url = require('url')
jieba.load();

(async () => {
  let begun = await has('http://www.seu.edu.cn')
  if (!begun) {
    await enqueue('http://www.seu.edu.cn')
  }
  while (true) {
    let href = await dequeue()
    if (!href) {
      await sleep(10000)
      continue
    }

    log.write(href + '\n')
    href = encodeURI(href)

    await Promise.race([
      sleep(10000), // 超时控制
      (async () => {
        try {
          let res = await axios.head(href)

          if (res.status === 301 || res.status === 302) {
            await enqueue(url.resolve(href, res.headers['location']))
            return
          }

          if (res.status !== 405 && !/text\/html/.test(res.headers['content-type'])) {
            log.write('-> Not html, pass: ' + res.headers['content-type'] + '\n')
            return
          }

          res = (await axios.get(href, { responseType: 'arraybuffer' })).data
          res = new iconv.Iconv(chardet.detect(res).encoding, 'UTF-8//TRANSLIT//IGNORE').convert(res).toString()
          res = res.replace(/<!([^<>]*<[^<>]*>)*[^<>]*>/img, '')
          res = res.replace(/<\s*(script|style|template)[\s\S]*?<\s*\/\s*\1\s*>/img, '')
          res = res.replace(/([>^])\s+([<$])/img, '$1$2')

          let links = (res.match(/[\s<]a[^<>]*\shref\s*=(".*?"|'.*?'|[^\s>]*)/img) || [])
            .map(k => /\shref\s*=(".*?"|'.*?'|[^\s>]*)/img.exec(k)[1])

          let title = /<\s*title.*?>([\s\S]*?)<\s*\/\s*title\s*>/img.exec(res)
          title = title ? title[1] : ''

          // 标签要换成一个空格，方便隔开无关内容
          res = res.replace(/<[^>]*>/mg, ' ')

          // HTML 反转义
          res = res.replace(/&nbsp;/g, ' ')
          res = res.replace(/&amp;/g, '&')
          res = res.replace(/&lt;/g, '<')
          res = res.replace(/&gt;/g, '>')

          // 最后把多个连续空格转成一个
          res = res.replace(/\s\s+/mg, ' ')

          await push(title, res, href)

          await Promise.all(links.map(async k => {
            k = k.replace(/^"(.*)"$/, '$1')
            k = k.replace(/^'(.*)'$/, '$1')
            k = url.resolve(href, k)
            k = k.split('#')[0]
            if (filter(k) && k !== href && !await has(k)) {
              await enqueue(k)
              log.write('-> ' + k + '\n')
            }
          }))
        } catch (e) {
          log.write('-> Failed to fetch: ' + e.message + '\n')
        }
      })()
    ])
  }
  await sleep(500)
})()
