const config = require('./config.json')
const axios = require('axios').create(config.axios)
const cheerio = require('cheerio')
const { URL } = require('url')
const query = require('querystring')

module.exports = {
  async submitForm(pUrl, pParams, pHeaders = {}) {
    let headers = JSON.parse(JSON.stringify(pHeaders))

    let [url, id] = pUrl.split('#').concat('')
    let res = await axios.get(url, { headers })
    let cookie = res.headers['set-cookie'][0].split(';')[0]
    let $ = cheerio.load(res.data)
    if (id) {
      id = `[name="${id}"]`
    }
    let form = $('form' + id)
    let action = new URL(form.attr('action'), url).href
    let method = (form.attr('method') || 'POST').toLowerCase()
    let params = {}

    $('form' + id + ' input').each((i, input) => {
      params[$(input).attr('name')] = $(input).attr('value')
    })

    $('form' + id + ' select').each((i, select) => {
      params[$(select).attr('name')] = $(select).children('option[selected]').attr('value')
    })

    $('form' + id + ' textarea').each((i, textarea) => {
      params[$(textarea).attr('name')] = $(textarea).text()
    })

    for (let key in pParams) {
      if (pParams.hasOwnProperty(key)) {
        params[key] = pParams[key]
      }
    }
    headers.Cookie = cookie

    console.log(action, method, JSON.stringify(params, null, 2), headers)
    return await axios[method](action, query.stringify(params), { headers })
  }
}